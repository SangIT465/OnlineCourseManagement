using System.ComponentModel.DataAnnotations;

namespace OnlineCourseManagement.DTOs;

public sealed class CreatePurchaseDto
{
    [Range(1, int.MaxValue)] public int CourseId { get; set; }
    [Required, MinLength(2), MaxLength(100)] public string BuyerName { get; set; } = "";
    [Required(ErrorMessage = "Vui lòng nhập số điện thoại.")]
    [RegularExpression("[0-9]{10}", ErrorMessage = "Số điện thoại phải gồm đúng 10 chữ số từ 0–9, không có chữ, khoảng trắng hoặc ký tự đặc biệt.")]
    public string BuyerPhone { get; set; } = "";
    [Required(ErrorMessage = "Vui lòng nhập địa chỉ."), MaxLength(300)] public string BuyerAddress { get; set; } = "";
}

public sealed record PurchaseView(int Id, long OrderCode, string InvoiceNumber, int CourseId,
    string CourseTitle, string CategoryName, string Status, decimal OriginalPrice, int Amount,
    string Currency, string BuyerName, string BuyerEmail, string BuyerPhone, string BuyerAddress,
    string SellerName, string SellerAddress, string SellerContact, DateTime CreatedAt, DateTime? PaidAt,
    string? CheckoutUrl, string? QrCodeDataUrl, string? BankName, string? BankAccountName,
    string? BankAccountNumber, string? PaymentReference, bool PaymentConfigured)
{
    public bool CanConfirmDemoPayment { get; init; }
}
