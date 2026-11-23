using System.Text.Json;
using OnlineCourseManagement.Models;

namespace OnlineCourseManagement.Services;

public sealed record GatewayLink(string Id, long OrderCode, long Amount, string Status,
    string CheckoutUrl, string? QrPayload = null, string? BankName = null,
    string? BankAccountName = null, string? BankAccountNumber = null);
public sealed record GatewayPayment(string Id, long OrderCode, long Amount, long AmountPaid, string Status);
public sealed record GatewayNotice(long OrderCode, string PaymentLinkId, long Amount,
    string Reference, string Currency, bool Success);

public interface IPayOSGateway
{
    bool IsConfigured { get; }
    Task<GatewayLink> CreateAsync(CoursePurchase purchase, CancellationToken token);
    Task<GatewayPayment> GetAsync(long orderCode, CancellationToken token);
    Task<GatewayNotice> VerifyWebhookAsync(JsonElement body, CancellationToken token);
}
