using System.Data;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using OnlineCourseManagement.Data;
using OnlineCourseManagement.DTOs;
using OnlineCourseManagement.Exceptions;
using OnlineCourseManagement.Models;
using OnlineCourseManagement.Options;
using OnlineCourseManagement.Security;

namespace OnlineCourseManagement.Services;

public sealed class DemoPaymentService(AppDbContext db, PurchaseService purchases,
    IOptions<DemoPaymentOptions> options, IHostEnvironment environment, TimeProvider time)
{
    public bool IsEnabled => environment.IsDevelopment() && options.Value.Enabled;

    public bool CanConfirm(ClaimsPrincipal actor, PurchaseView purchase) =>
        IsEnabled && actor.IsInRole(AppRoles.User) && purchase.Status == PurchaseStatus.Pending;

    public async Task<PurchaseView> ConfirmAsync(int id, ClaimsPrincipal actor, CancellationToken token)
    {
        if (!IsEnabled) throw BusinessException.NotFound("Thanh toán demo chưa được bật trong môi trường này.");
        if (!actor.IsInRole(AppRoles.User)) throw BusinessException.Forbidden();
        var studentId = actor.RequireUserId();
        await purchases.ReadAsync(id, actor, token);

        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, token);
        var student = await db.FindForUpdateAsync(studentId, token);
        if (student?.Role != AppRoles.User) throw BusinessException.Forbidden();
        var purchase = await db.CoursePurchases
            .FromSqlInterpolated($"SELECT * FROM [dbo].[CoursePurchases] WITH (UPDLOCK, HOLDLOCK) WHERE [Id] = {id}")
            .SingleAsync(token);
        if (purchase.StudentId != studentId) throw BusinessException.NotFound("Đơn mua khóa học không tồn tại.");
        if (purchase.Status == PurchaseStatus.Pending)
        {
            purchase.Status = PurchaseStatus.Paid;
            purchase.PaidAt = time.GetUtcNow().UtcDateTime;
            purchase.PaymentReference = $"DEMO-{purchase.OrderCode}";
        }
        else if (purchase.Status != PurchaseStatus.Paid)
            throw BusinessException.Conflict("Đơn đã đóng. Vui lòng tạo đơn mới để thanh toán demo.");

        if (!await db.Enrollments.AnyAsync(e => e.StudentId == studentId && e.CourseId == purchase.CourseId, token))
            db.Enrollments.Add(new Enrollment
            {
                StudentId = studentId, CourseId = purchase.CourseId, EnrolledAt = time.GetUtcNow().UtcDateTime
            });
        await db.SaveChangesAsync(token);
        await transaction.CommitAsync(token);
        return purchases.View(purchase);
    }
}
