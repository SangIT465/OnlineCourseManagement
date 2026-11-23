using System.ComponentModel.DataAnnotations;

namespace OnlineCourseManagement.Models;

public static class PurchaseStatus
{
    public const string Pending = "PendingPayment";
    public const string Paid = "Paid";
    public const string Cancelled = "Cancelled";
    public const string Expired = "Expired";
}

public sealed class CoursePurchase
{
    public int Id { get; set; }
    public long OrderCode { get; set; }
    public int StudentId { get; set; }
    public User Student { get; set; } = null!;
    public int CourseId { get; set; }
    public Course Course { get; set; } = null!;
    [MaxLength(24)] public string Status { get; set; } = PurchaseStatus.Pending;
    public decimal OriginalPrice { get; set; }
    public int Amount { get; set; }
    [MaxLength(3)] public string Currency { get; set; } = "VND";
    [MaxLength(200)] public string CourseTitle { get; set; } = "";
    [MaxLength(100)] public string CategoryName { get; set; } = "";
    [MaxLength(100)] public string BuyerName { get; set; } = "";
    [MaxLength(255)] public string BuyerEmail { get; set; } = "";
    [MaxLength(30)] public string BuyerPhone { get; set; } = "";
    [MaxLength(300)] public string BuyerAddress { get; set; } = "";
    [MaxLength(150)] public string SellerName { get; set; } = "CourseFlow";
    [MaxLength(300)] public string SellerAddress { get; set; } = "";
    [MaxLength(100)] public string SellerContact { get; set; } = "";
    [MaxLength(100)] public string? PaymentLinkId { get; set; }
    [MaxLength(1000)] public string? CheckoutUrl { get; set; }
    [MaxLength(4000)] public string? QrPayload { get; set; }
    [MaxLength(100)] public string? BankName { get; set; }
    [MaxLength(100)] public string? BankAccountName { get; set; }
    [MaxLength(50)] public string? BankAccountNumber { get; set; }
    [MaxLength(100)] public string? PaymentReference { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? PaidAt { get; set; }
}
