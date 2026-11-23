using System.Security.Claims;
using System.Security.Cryptography;
using OnlineCourseManagement.Exceptions;
using OnlineCourseManagement.Models;
using OnlineCourseManagement.Security;

namespace OnlineCourseManagement.Services;

public static class PurchaseRules
{
    public static int AmountInVnd(decimal price)
    {
        var rounded = decimal.Round(price, 0, MidpointRounding.AwayFromZero);
        if (price < 0 || rounded > int.MaxValue || (price > 0 && rounded < 1))
            throw BusinessException.Invalid("Giá khóa học không phù hợp với thanh toán VND.");
        return (int)rounded;
    }

    public static long NewOrderCode() => checked((long)(BitConverter.ToUInt64(RandomNumberGenerator.GetBytes(8))
        % 900_000_000_000_000UL + 100_000_000_000_000UL));

    public static bool CanRead(ClaimsPrincipal actor, CoursePurchase purchase) =>
        actor.Identity?.IsAuthenticated == true && (actor.IsInRole(AppRoles.Admin) ||
        (actor.IsInRole(AppRoles.User) && actor.FindFirstValue(ClaimTypes.NameIdentifier) == purchase.StudentId.ToString()));

    public static void ValidatePayment(CoursePurchase purchase, GatewayPayment payment)
    {
        if (payment.OrderCode != purchase.OrderCode || payment.Amount != purchase.Amount ||
            (!string.IsNullOrEmpty(purchase.PaymentLinkId) && payment.Id != purchase.PaymentLinkId))
            throw BusinessException.Conflict("Thông tin thanh toán không khớp với đơn mua khóa học.");
        if (payment.Status.Equals("PAID", StringComparison.OrdinalIgnoreCase) && payment.AmountPaid < purchase.Amount)
            throw BusinessException.Conflict("payOS chưa ghi nhận đủ số tiền của đơn.");
    }
}
