using System.Security.Claims;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using OnlineCourseManagement.Data;
using OnlineCourseManagement.Exceptions;
using OnlineCourseManagement.Models;
using OnlineCourseManagement.Options;
using OnlineCourseManagement.Security;
using OnlineCourseManagement.Services;

namespace OnlineCourseManagement.Api.Tests;

public sealed class PurchaseTests
{
    [Theory]
    [InlineData("")]
    [InlineData("DAN_CLIENT_ID_VAO_DAY")]
    [InlineData("DAN_API_KEY_VAO_DAY")]
    [InlineData("DAN_CHECKSUM_KEY_VAO_DAY")]
    [InlineData("<CLIENT_ID>")]
    [InlineData("DIEN_API_KEY")]
    [InlineData("YOUR_CHECKSUM_KEY")]
    [InlineData(" invalid-key ")]
    [InlineData("\u0016")]
    [InlineData("a")]
    [InlineData("*")]
    [InlineData("invalid\u0016key")]
    public void Missing_or_example_keys_do_not_enable_payment(string invalid)
    {
        var options = new PayOSPaymentOptions { ClientId="test-client", ApiKey="test-api", ChecksumKey="test-checksum" };
        Assert.True(options.IsConfigured);
        options.ClientId = invalid;
        Assert.False(options.IsConfigured);
        options.ClientId = "test-client";
        options.ApiKey = invalid;
        Assert.False(options.IsConfigured);
        options.ApiKey = "test-api";
        options.ChecksumKey = invalid;
        Assert.False(options.IsConfigured);
    }

    [Theory]
    [InlineData(0, 0)] [InlineData(1000, 1000)] [InlineData(199000.50, 199001)]
    public void Charges_are_server_rounded_to_whole_VND(decimal price, int expected) => Assert.Equal(expected,PurchaseRules.AmountInVnd(price));

    [Theory]
    [InlineData(-1)] [InlineData(0.4)] [InlineData(3000000000)]
    public void Invalid_or_unsupported_prices_are_rejected(decimal price) => Assert.Throws<BusinessException>(()=>PurchaseRules.AmountInVnd(price));

    [Theory]
    [InlineData("User", 12, true)] [InlineData("User", 99, false)] [InlineData("Admin", 99, true)]
    [InlineData("Staff", 12, false)] [InlineData("Instructor", 12, false)]
    public void Bills_enforce_role_and_ownership(string role,int actorId,bool expected)
    {
        var actor = new ClaimsPrincipal(new ClaimsIdentity([new(ClaimTypes.NameIdentifier,actorId.ToString()),new(ClaimTypes.Role,role)],"test"));
        Assert.Equal(expected,PurchaseRules.CanRead(actor,new CoursePurchase {StudentId=12}));
    }

    [Fact]
    public void Gateway_amount_order_and_link_must_match_and_be_fully_paid()
    {
        var order = new CoursePurchase {OrderCode=123,Amount=20000,PaymentLinkId="link"};
        PurchaseRules.ValidatePayment(order,new("link",123,20000,20000,"PAID"));
        foreach(var invalid in new GatewayPayment[] {new("link",999,20000,20000,"PAID"),new("bad",123,20000,20000,"PAID"),new("link",123,100,100,"PAID"),new("link",123,20000,100,"PAID")})
            Assert.Throws<BusinessException>(()=>PurchaseRules.ValidatePayment(order,invalid));
    }

    [Fact]
    public void Invoice_escapes_snapshots_and_distinguishes_pending_from_paid()
    {
        var gateway = new FakeGateway();
        using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlServer("Server=(local);Database=ModelOnly;Integrated Security=True;TrustServerCertificate=True").Options);
        var service = new PurchaseService(db,gateway,Microsoft.Extensions.Options.Options.Create(new PayOSPaymentOptions()),TimeProvider.System);
        var order = new CoursePurchase {Id=1,OrderCode=123,BuyerName="<script>alert(1)</script>",CourseTitle="<img onerror=x>",
            Amount=20000,QrPayload="QR test",CreatedAt=DateTime.UtcNow};
        var pending = service.View(order);
        Assert.StartsWith("data:image/png;base64,",pending.QrCodeDataUrl);
        var png = Convert.FromBase64String(pending.QrCodeDataUrl!.Split(',')[1]);
        Assert.Equal(new byte[]{137,80,78,71,13,10,26,10},png[..8]);
        var html = PurchaseInvoice.Render(pending);
        Assert.Contains("CHỜ THANH TOÁN",html);
        Assert.Contains("&lt;script&gt;",html);
        Assert.DoesNotContain("<script>",html);
        order.Status=PurchaseStatus.Paid; order.PaidAt=DateTime.UtcNow;
        var paid = service.View(order);
        Assert.Null(paid.QrCodeDataUrl);
        Assert.Contains("ĐÃ THANH TOÁN",PurchaseInvoice.Render(paid));
    }

    [Fact]
    public async Task Invalid_payOS_webhook_signature_is_rejected_without_network()
    {
        var gateway = new PayOSGateway(Microsoft.Extensions.Options.Options.Create(new PayOSPaymentOptions
            { ClientId="test-client",ApiKey="test-api",ChecksumKey="test-checksum" }),NullLogger<PayOSGateway>.Instance);
        using var body = JsonDocument.Parse("""{"code":"00","success":true,"data":{"orderCode":123,"amount":20000,"currency":"VND"},"signature":"forged"}""");
        await Assert.ThrowsAsync<BusinessException>(()=>gateway.VerifyWebhookAsync(body.RootElement,CancellationToken.None));
    }

    [Fact]
    public async Task Valid_signed_payOS_webhook_survives_JSON_mapping_and_tampering_fails()
    {
        var options = new PayOSPaymentOptions {ClientId="test-client",ApiKey="test-api",ChecksumKey="test-checksum"};
        var client = new PayOS.PayOSClient(options.ClientId,options.ApiKey,options.ChecksumKey);
        var data = new PayOS.Models.Webhooks.WebhookData
        {
            OrderCode=123,Amount=20000,Description="CF123",AccountNumber="123456789",Reference="BANKREF",
            TransactionDateTime="2026-11-23 12:00:00",Currency="VND",PaymentLinkId="test-link",Code="00",
            Description2="Thanh cong",CounterAccountBankId="",CounterAccountBankName="",CounterAccountName="",
            CounterAccountNumber="",VirtualAccountName="",VirtualAccountNumber=""
        };
        var signature=client.Crypto.CreateSignatureFromObject(data,options.ChecksumKey) ?? throw new InvalidOperationException("Missing test signature");
        var webhook=new PayOS.Models.Webhooks.Webhook {Code="00",Description="success",Success=true,Data=data,Signature=signature};
        var json=JsonSerializer.Serialize(webhook,new JsonSerializerOptions(JsonSerializerDefaults.Web));
        var gateway=new PayOSGateway(Microsoft.Extensions.Options.Options.Create(options),NullLogger<PayOSGateway>.Instance);
        using var valid=JsonDocument.Parse(json);
        var notice=await gateway.VerifyWebhookAsync(valid.RootElement,default);
        Assert.True(notice.Success);Assert.Equal(20000,notice.Amount);Assert.Equal("test-link",notice.PaymentLinkId);
        using var tampered=JsonDocument.Parse(json.Replace("20000","100"));
        await Assert.ThrowsAsync<BusinessException>(()=>gateway.VerifyWebhookAsync(tampered.RootElement,default));
    }

    [Fact]
    public void Order_codes_fit_JavaScript_safe_integer_and_have_no_duplicates_in_sample()
    {
        var codes = Enumerable.Range(0,1000).Select(_=>PurchaseRules.NewOrderCode()).ToList();
        Assert.Equal(codes.Count,codes.Distinct().Count());
        Assert.All(codes,code=>Assert.InRange(code,1,9007199254740991));
    }

    [Fact]
    public void Schema_keeps_bill_history_and_enforces_one_pending_order()
    {
        using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlServer("Server=(local);Database=ModelOnly;Integrated Security=True;TrustServerCertificate=True").Options);
        var model = db.Model.FindEntityType(typeof(CoursePurchase))!;
        Assert.All(model.GetForeignKeys(),fk=>Assert.Equal(DeleteBehavior.Restrict,fk.DeleteBehavior));
        Assert.Contains(model.GetIndexes(),index=>index.IsUnique && index.GetFilter()=="[Status] = N'PendingPayment'");
    }
}

internal sealed class FakeGateway : IPayOSGateway
{
    public bool IsConfigured => true;
    public bool Paid {get;set;}
    public CoursePurchase? Last {get;set;}
    public Task<GatewayLink> CreateAsync(CoursePurchase p,CancellationToken token) {Last=p;return Task.FromResult(new GatewayLink("test-link",p.OrderCode,p.Amount,"PENDING","https://pay.payos.vn/web/test-link","TEST QR"));}
    public Task<GatewayPayment> GetAsync(long code,CancellationToken token) => Task.FromResult(new GatewayPayment("test-link",code,Last!.Amount,Paid?Last.Amount:0,Paid?"PAID":"PENDING"));
    public Task<GatewayNotice> VerifyWebhookAsync(JsonElement body,CancellationToken token) => Task.FromResult(new GatewayNotice(Last!.OrderCode,"test-link",Last.Amount,"TEST-BANK-REF","VND",true));
}
