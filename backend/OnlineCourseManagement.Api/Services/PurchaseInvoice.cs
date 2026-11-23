using System.Globalization;
using System.Net;
using OnlineCourseManagement.DTOs;
using OnlineCourseManagement.Models;

namespace OnlineCourseManagement.Services;

public static class PurchaseInvoice
{
    public static string Render(PurchaseView bill)
    {
        static string H(object? text) => WebUtility.HtmlEncode(text?.ToString() ?? "");
        static string Money(decimal amount) => amount.ToString("N0", CultureInfo.GetCultureInfo("vi-VN")) + " đ";
        static string Date(DateTime value) => value.ToUniversalTime().AddHours(7).ToString("dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture) + " (GMT+7)";
        var paid = bill.Status == PurchaseStatus.Paid;
        return $$"""
        <!doctype html><html lang="vi"><head><meta charset="utf-8"><title>{{H(bill.InvoiceNumber)}}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>@page{size:A4;margin:18mm}*{box-sizing:border-box}body{font:14px/1.6 Arial,sans-serif;color:#18372e;margin:0;background:white}.sheet{max-width:760px;margin:30px auto;padding:24px}header{display:flex;justify-content:space-between;border-bottom:3px solid #14674f;padding-bottom:18px}h1{font-size:25px;margin:24px 0 6px}h2{font-size:20px;margin:0}p{margin:5px 0}.muted{color:#63766e}.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:24px 0}.label{font-size:12px;color:#63766e}table{width:100%;border-collapse:collapse;margin:24px 0}th,td{padding:12px 8px;border-bottom:1px solid #dce7e1;text-align:left}th{background:#eff6f2}.right{text-align:right}.total{font-size:22px;font-weight:bold}.status{padding:8px 12px;background:#eff6f2;font-weight:bold}.qr{width:210px;height:210px;object-fit:contain}.payment{display:flex;gap:24px;align-items:center;border:1px solid #dce7e1;padding:18px}footer{margin-top:32px;border-top:1px solid #dce7e1;padding-top:16px;font-size:12px}@media print{.sheet{margin:0;padding:0;max-width:none}table,.payment,footer{break-inside:avoid} }</style></head>
        <body><main class="sheet"><header><div><h2>{{H(bill.SellerName)}}</h2><p>{{H(bill.SellerAddress)}}</p><p>{{H(bill.SellerContact)}}</p></div><div class="right"><strong>{{H(bill.InvoiceNumber)}}</strong><p>Đơn hàng #{{H(bill.OrderCode)}}</p></div></header>
        <h1>{{(paid ? "HÓA ĐƠN MUA KHÓA HỌC" : "PHIẾU ĐẶT MUA KHÓA HỌC")}}</h1>
        <p class="status">{{(paid ? "ĐÃ THANH TOÁN" : bill.Status == PurchaseStatus.Pending ? "CHỜ THANH TOÁN" : "ĐƠN ĐÃ ĐÓNG")}}</p>
        <div class="grid"><section><div class="label">NGƯỜI MUA</div><strong>{{H(bill.BuyerName)}}</strong><p>{{H(bill.BuyerEmail)}}</p><p>{{H(bill.BuyerPhone)}}</p><p>{{H(bill.BuyerAddress)}}</p></section><section><div class="label">THÔNG TIN ĐƠN</div><p>Ngày tạo: {{H(Date(bill.CreatedAt))}}</p><p>Ngày thanh toán: {{H(bill.PaidAt is { } at ? Date(at) : "Chưa thanh toán")}}</p><p>Phương thức: {{(bill.Amount == 0 ? "Khóa học miễn phí" : "payOS")}}</p><p>Tham chiếu: {{H(bill.PaymentReference ?? "Chưa có")}}</p></section></div>
        <table><thead><tr><th>Khóa học</th><th>SL</th><th class="right">Đơn giá</th><th class="right">Thành tiền</th></tr></thead><tbody><tr><td><strong>{{H(bill.CourseTitle)}}</strong><br><span class="muted">{{H(bill.CategoryName)}}</span></td><td>1</td><td class="right">{{H(Money(bill.Amount))}}</td><td class="right">{{H(Money(bill.Amount))}}</td></tr></tbody></table>
        <p class="right">Đơn vị tiền tệ: VND · Số lượng: 1 khóa học</p><p class="right total">Tổng cộng: {{H(Money(bill.Amount))}}</p>
        <p class="right">Đã thanh toán: {{H(Money(paid ? bill.Amount : 0))}} · Còn phải trả: {{H(Money(paid ? 0 : bill.Amount))}}</p>
        {{(bill.QrCodeDataUrl is null ? "" : $"<section class=\"payment\"><img class=\"qr\" src=\"{H(bill.QrCodeDataUrl)}\" alt=\"Mã QR thanh toán payOS\"><div><strong>Quét mã bằng ứng dụng ngân hàng</strong><p>Số tiền: {H(Money(bill.Amount))}</p><p>Nội dung: CF{H(bill.OrderCode)}</p><p>{H(bill.BankAccountName)} · {H(bill.BankAccountNumber)}</p><p class=\"muted\">Quyền học được mở sau khi payOS xác nhận thanh toán.</p></div></section>")}}
        <footer><p>Cảm ơn bạn đã lựa chọn {{H(bill.SellerName)}}.</p><p>Chứng từ mua khóa học của hệ thống; chưa tích hợp nhà cung cấp hóa đơn điện tử thuế.</p></footer></main></body></html>
        """;
    }
}
