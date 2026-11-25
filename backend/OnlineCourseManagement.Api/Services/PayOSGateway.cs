using System.Globalization;
using System.Text.Json;
using Microsoft.Extensions.Options;
using OnlineCourseManagement.Exceptions;
using OnlineCourseManagement.Models;
using OnlineCourseManagement.Options;
using PayOS;
using PayOS.Models;
using PayOS.Models.V2.PaymentRequests;
using PayOS.Models.Webhooks;

namespace OnlineCourseManagement.Services;

public sealed class PayOSGateway(IOptions<PayOSPaymentOptions> configured, ILogger<PayOSGateway> logger) : IPayOSGateway
{
    private readonly PayOSPaymentOptions _options = configured.Value;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    public bool IsConfigured => _options.IsConfigured;

    private PayOSClient Client()
    {
        if (!IsConfigured) throw BusinessException.Invalid("Chưa cấu hình kênh thanh toán payOS. Vui lòng liên hệ quản trị viên.");
        return new PayOSClient(new PayOSOptions
        {
            ClientId = _options.ClientId, ApiKey = _options.ApiKey, ChecksumKey = _options.ChecksumKey,
            TimeoutMs = 15000, MaxRetries = 0
        });
    }

    public async Task<GatewayLink> CreateAsync(CoursePurchase purchase, CancellationToken token)
    {
        var client = Client();
        var returnUrl = $"{_options.FrontendUrl.TrimEnd('/')}/#/purchases/{purchase.Id}";
        try
        {
            var result = await client.PaymentRequests.CreateAsync(new CreatePaymentLinkRequest
            {
                OrderCode = purchase.OrderCode, Amount = purchase.Amount,
                Description = $"CF{purchase.OrderCode}", ReturnUrl = returnUrl, CancelUrl = returnUrl
            }, new RequestOptions<CreatePaymentLinkRequest> { CancellationToken = token });
            return new(result.PaymentLinkId, result.OrderCode, result.Amount, result.Status.ToString(),
                result.CheckoutUrl, result.QrCode, result.Bin, result.AccountName, result.AccountNumber);
        }
        catch (OperationCanceledException) when (token.IsCancellationRequested) { throw; }
        catch (Exception error)
        {
            // Recover a link created by payOS before a timeout/process interruption. The same
            // orderCode is used, so retrying never silently creates a second payment order.
            logger.LogWarning("payOS create/recovery for order {OrderCode}: {ErrorType}", purchase.OrderCode, error.GetType().Name);
            try
            {
                var existing = await GetAsync(purchase.OrderCode, token);
                if (string.IsNullOrWhiteSpace(existing.Id) || existing.Id.Any(c => !char.IsAsciiLetterOrDigit(c) && c != '-'))
                    throw BusinessException.Invalid("Tham chiếu thanh toán không hợp lệ.");
                var checkout = $"https://pay.payos.vn/web/{existing.Id}";
                // If the original bank payload was lost, the recovery QR opens payOS checkout.
                return new(existing.Id, existing.OrderCode, existing.Amount, existing.Status, checkout, checkout);
            }
            catch (OperationCanceledException) when (token.IsCancellationRequested) { throw; }
            catch (Exception)
            {
                throw BusinessException.Conflict("Chưa tạo được liên kết payOS. Đơn đã được lưu; hãy thử lại sau.");
            }
        }
    }

    public async Task<GatewayPayment> GetAsync(long orderCode, CancellationToken token)
    {
        try
        {
            var result = await Client().PaymentRequests.GetAsync(orderCode.ToString(CultureInfo.InvariantCulture), new RequestOptions { CancellationToken = token });
            return new(result.Id, result.OrderCode, result.Amount, result.AmountPaid, result.Status.ToString());
        }
        catch (BusinessException) { throw; }
        catch (OperationCanceledException) when (token.IsCancellationRequested) { throw; }
        catch (Exception error)
        {
            logger.LogWarning("payOS lookup failed for order {OrderCode}: {ErrorType}", orderCode, error.GetType().Name);
            throw BusinessException.Conflict("Chưa kiểm tra được thanh toán với payOS. Vui lòng thử lại.");
        }
    }

    public async Task<GatewayPayment> CancelAsync(long orderCode, CancellationToken token)
    {
        try
        {
            var result = await Client().PaymentRequests.CancelAsync(orderCode, "Hủy thanh toán từ CourseFlow",
                new RequestOptions<CancelPaymentLinkRequest> { CancellationToken = token });
            return new(result.Id, result.OrderCode, result.Amount, result.AmountPaid, result.Status.ToString());
        }
        catch (OperationCanceledException) when (token.IsCancellationRequested) { throw; }
        catch (BusinessException) { throw; }
        catch (Exception error)
        {
            logger.LogWarning("payOS cancellation for order {OrderCode}: {ErrorType}", orderCode, error.GetType().Name);
            // A timeout may happen after cancellation, or payment may win the race.
            try
            {
                var current = await GetAsync(orderCode, token);
                if (current.Status.Equals("PAID", StringComparison.OrdinalIgnoreCase) ||
                    current.Status.Equals("CANCELLED", StringComparison.OrdinalIgnoreCase) ||
                    current.Status.Equals("EXPIRED", StringComparison.OrdinalIgnoreCase)) return current;
            }
            catch (OperationCanceledException) when (token.IsCancellationRequested) { throw; }
            catch (Exception) { /* Keep the local order pending until payOS confirms its final state. */ }
            throw BusinessException.Conflict("Chưa hủy được thanh toán trên payOS. Đơn chưa được thay đổi; vui lòng thử lại.");
        }
    }

    public async Task<GatewayNotice> VerifyWebhookAsync(JsonElement body, CancellationToken token)
    {
        try
        {
            var webhook = body.Deserialize<Webhook>(JsonOptions) ?? throw new JsonException();
            // Only the official SDK's verified data is trusted; outer success flags are not authority.
            var verified = await Client().Webhooks.VerifyAsync(webhook);
            return new(verified.OrderCode, verified.PaymentLinkId, verified.Amount,
                verified.Reference ?? "", verified.Currency ?? "", verified.Code == "00");
        }
        catch (BusinessException) { throw; }
        catch (Exception)
        {
            throw BusinessException.Invalid("Chữ ký hoặc nội dung webhook payOS không hợp lệ.");
        }
    }
}
