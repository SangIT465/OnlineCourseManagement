using System.Data;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using OnlineCourseManagement.Data;
using OnlineCourseManagement.DTOs;
using OnlineCourseManagement.Exceptions;
using OnlineCourseManagement.Models;
using OnlineCourseManagement.Options;
using OnlineCourseManagement.Security;
using QRCoder;

namespace OnlineCourseManagement.Services;

public sealed class PurchaseService(AppDbContext db, IPayOSGateway gateway,
    IOptions<PayOSPaymentOptions> configured, TimeProvider time)
{
    public async Task<PurchaseView> CreateAsync(CreatePurchaseDto input, ClaimsPrincipal actor, CancellationToken token)
    {
        var studentId = actor.RequireUserId();
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, token);
        var student = await db.FindForUpdateAsync(studentId, token);
        if (student?.Role != AppRoles.User) throw BusinessException.Forbidden();
        var existing = await db.CoursePurchases.Where(p => p.StudentId == studentId && p.CourseId == input.CourseId
                && (p.Status == PurchaseStatus.Paid || p.Status == PurchaseStatus.Pending))
            .OrderByDescending(p => p.Status == PurchaseStatus.Paid).ThenByDescending(p => p.Id).FirstOrDefaultAsync(token);
        if (existing is not null)
        {
            if (existing.Status == PurchaseStatus.Paid) await EnsureEnrollmentAsync(existing, token);
            await db.SaveChangesAsync(token);
            await tx.CommitAsync(token);
            return View(existing);
        }
        var course = await db.Courses.Include(c => c.Category).SingleOrDefaultAsync(c => c.Id == input.CourseId, token)
            ?? throw BusinessException.NotFound("Khóa học không tồn tại.");
        if (await db.Enrollments.AnyAsync(e => e.StudentId == studentId && e.CourseId == course.Id, token))
            throw BusinessException.Conflict("Bạn đã ghi danh khóa học này. Không cần mua lại.");
        var options = configured.Value;
        var purchase = new CoursePurchase
        {
            OrderCode = PurchaseRules.NewOrderCode(), StudentId = studentId, CourseId = course.Id,
            OriginalPrice = course.Price, Amount = PurchaseRules.AmountInVnd(course.Price),
            CourseTitle = course.Title, CategoryName = course.Category?.Name ?? "",
            BuyerName = input.BuyerName.Trim(), BuyerEmail = student.Email,
            BuyerPhone = input.BuyerPhone?.Trim() ?? "", BuyerAddress = input.BuyerAddress?.Trim() ?? "",
            SellerName = options.SellerName, SellerAddress = options.SellerAddress, SellerContact = options.SellerContact,
            CreatedAt = time.GetUtcNow().UtcDateTime
        };
        if (purchase.BuyerName.Length < 2) throw BusinessException.Invalid("Vui lòng nhập họ tên người mua.");
        db.CoursePurchases.Add(purchase);
        if (purchase.Amount == 0)
        {
            purchase.Status = PurchaseStatus.Paid;
            purchase.PaidAt = time.GetUtcNow().UtcDateTime;
            purchase.PaymentReference = "FREE";
            await EnsureEnrollmentAsync(purchase, token);
        }
        await db.SaveChangesAsync(token);
        await tx.CommitAsync(token);
        return View(purchase);
    }

    public async Task<PurchaseView> GetAsync(int id, ClaimsPrincipal actor, CancellationToken token) =>
        View(await ReadAsync(id, actor, token));

    public async Task<IReadOnlyList<PurchaseView>> ListAsync(ClaimsPrincipal actor, bool all, int page, CancellationToken token)
    {
        if (all && !actor.IsInRole(AppRoles.Admin)) throw BusinessException.Forbidden();
        var query = db.CoursePurchases.AsNoTracking();
        if (!all) { var studentId = actor.RequireUserId(); query = query.Where(p => p.StudentId == studentId); }
        return (await query.OrderByDescending(p => p.Id).Skip((Math.Clamp(page, 1, 1_000_000) - 1) * 20)
            .Take(20).ToListAsync(token)).Select(p => View(p, includeQr: false)).ToList();
    }

    public async Task<PurchaseView> CreatePaymentLinkAsync(int id, ClaimsPrincipal actor, CancellationToken token)
    {
        var current = await ReadAsync(id, actor, token);
        if (current.StudentId != actor.RequireUserId() || !actor.IsInRole(AppRoles.User)) throw BusinessException.Forbidden();
        if (current.Status == PurchaseStatus.Paid) return View(current);
        if (!gateway.IsConfigured) throw BusinessException.Invalid("Chưa cấu hình payOS. Đơn đã lưu; vui lòng liên hệ quản trị viên.");
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, token);
        await db.FindForUpdateAsync(current.StudentId, token);
        var purchase = await LockAsync(id, token);
        if (purchase.Status != PurchaseStatus.Pending) return View(purchase);
        if (string.IsNullOrWhiteSpace(purchase.PaymentLinkId))
        {
            var result = await gateway.CreateAsync(purchase, token);
            if (result.OrderCode != purchase.OrderCode || result.Amount != purchase.Amount || string.IsNullOrWhiteSpace(result.Id))
                throw BusinessException.Conflict("Liên kết payOS không khớp với đơn.");
            if (!Uri.TryCreate(result.CheckoutUrl, UriKind.Absolute, out var url) || url.Scheme != "https" ||
                !url.Host.EndsWith(".payos.vn", StringComparison.OrdinalIgnoreCase))
                throw BusinessException.Conflict("Địa chỉ thanh toán payOS không hợp lệ.");
            purchase.PaymentLinkId = result.Id;
            purchase.CheckoutUrl = result.CheckoutUrl;
            purchase.QrPayload = result.QrPayload ?? result.CheckoutUrl;
            purchase.BankName = result.BankName;
            purchase.BankAccountName = result.BankAccountName;
            purchase.BankAccountNumber = result.BankAccountNumber;
            // A recovered link may have already been paid. Reconcile only through payOS lookup.
        }
        await db.SaveChangesAsync(token);
        await tx.CommitAsync(token);
        return await SyncAsync(id, actor, token);
    }

    public async Task<PurchaseView> SyncAsync(int id, ClaimsPrincipal actor, CancellationToken token)
    {
        var purchase = await ReadAsync(id, actor, token);
        if (purchase.Status == PurchaseStatus.Paid || string.IsNullOrWhiteSpace(purchase.PaymentLinkId)) return View(purchase);
        var payment = await gateway.GetAsync(purchase.OrderCode, token);
        await ApplyPaymentAsync(purchase.Id, payment, $"PAYOS-{purchase.OrderCode}", token);
        return await GetAsync(id, actor, token);
    }

    public async Task ReceiveWebhookAsync(JsonElement body, CancellationToken token)
    {
        var notice = await gateway.VerifyWebhookAsync(body, token);
        if (!notice.Success || notice.Currency != "VND") return;
        var purchase = await db.CoursePurchases.AsNoTracking().SingleOrDefaultAsync(p => p.OrderCode == notice.OrderCode, token);
        // payOS sends a signed example when a channel webhook is registered.
        if (purchase is null) return;
        if ((!string.IsNullOrEmpty(purchase.PaymentLinkId) && notice.PaymentLinkId != purchase.PaymentLinkId) || notice.Amount != purchase.Amount)
            throw BusinessException.Conflict("Webhook không khớp đơn thanh toán.");
        // Verify both the signed event AND the live link state; a forged return URL never settles an order.
        var payment = await gateway.GetAsync(purchase.OrderCode, token);
        if (payment.Id != notice.PaymentLinkId) throw BusinessException.Conflict("Tham chiếu webhook không khớp payOS.");
        await ApplyPaymentAsync(purchase.Id, payment, notice.Reference, token);
    }

    public async Task<CoursePurchase> ReadAsync(int id, ClaimsPrincipal actor, CancellationToken token)
    {
        var purchase = await db.CoursePurchases.AsNoTracking().SingleOrDefaultAsync(p => p.Id == id, token)
            ?? throw BusinessException.NotFound("Đơn mua khóa học không tồn tại.");
        if (!PurchaseRules.CanRead(actor, purchase)) throw BusinessException.NotFound("Đơn mua khóa học không tồn tại.");
        return purchase;
    }

    private async Task ApplyPaymentAsync(int id, GatewayPayment payment, string reference, CancellationToken token)
    {
        var before = await db.CoursePurchases.AsNoTracking().SingleAsync(p => p.Id == id, token);
        db.ChangeTracker.Clear();
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, token);
        await db.FindForUpdateAsync(before.StudentId, token);
        var purchase = await LockAsync(id, token);
        PurchaseRules.ValidatePayment(purchase, payment);
        purchase.PaymentLinkId ??= payment.Id;
        if (purchase.Status != PurchaseStatus.Paid)
        {
            if (payment.Status.Equals("PAID", StringComparison.OrdinalIgnoreCase))
            {
                purchase.Status = PurchaseStatus.Paid;
                purchase.PaidAt = time.GetUtcNow().UtcDateTime;
                purchase.PaymentReference = reference.Length <= 100 ? reference : reference[..100];
                await EnsureEnrollmentAsync(purchase, token);
            }
            else if (payment.Status.Equals("CANCELLED", StringComparison.OrdinalIgnoreCase)) purchase.Status = PurchaseStatus.Cancelled;
            else if (payment.Status.Equals("EXPIRED", StringComparison.OrdinalIgnoreCase)) purchase.Status = PurchaseStatus.Expired;
        }
        await db.SaveChangesAsync(token);
        await tx.CommitAsync(token);
    }

    private async Task EnsureEnrollmentAsync(CoursePurchase purchase, CancellationToken token)
    {
        if (!await db.Users.AnyAsync(u => u.Id == purchase.StudentId && u.Role == AppRoles.User, token)) return;
        if (!await db.Enrollments.AnyAsync(e => e.StudentId == purchase.StudentId && e.CourseId == purchase.CourseId, token))
            db.Enrollments.Add(new Enrollment { StudentId = purchase.StudentId, CourseId = purchase.CourseId,
                EnrolledAt = time.GetUtcNow().UtcDateTime });
    }

    private Task<CoursePurchase> LockAsync(int id, CancellationToken token) => db.CoursePurchases
        .FromSqlInterpolated($"SELECT * FROM [dbo].[CoursePurchases] WITH (UPDLOCK, HOLDLOCK) WHERE [Id] = {id}")
        .SingleAsync(token);

    public PurchaseView View(CoursePurchase p, bool includeQr = true)
    {
        string? qr = null;
        if (includeQr && p.Status == PurchaseStatus.Pending && !string.IsNullOrWhiteSpace(p.QrPayload))
            qr = "data:image/png;base64," + Convert.ToBase64String(PngByteQRCodeHelper.GetQRCode(p.QrPayload, QRCodeGenerator.ECCLevel.M, 6));
        return new(p.Id, p.OrderCode, $"CF-{p.OrderCode}", p.CourseId, p.CourseTitle, p.CategoryName,
            p.Status, p.OriginalPrice, p.Amount, p.Currency, p.BuyerName, p.BuyerEmail, p.BuyerPhone, p.BuyerAddress,
            p.SellerName, p.SellerAddress, p.SellerContact, p.CreatedAt, p.PaidAt,
            p.CheckoutUrl, qr, p.BankName, p.BankAccountName, p.BankAccountNumber, p.PaymentReference, gateway.IsConfigured);
    }
}
