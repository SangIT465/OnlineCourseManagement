using System.Security.Claims;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using OnlineCourseManagement.Data;
using OnlineCourseManagement.DTOs;
using OnlineCourseManagement.Exceptions;
using OnlineCourseManagement.Models;
using OnlineCourseManagement.Options;
using OnlineCourseManagement.Services;

namespace OnlineCourseManagement.Api.Tests;

public sealed class PurchaseSqlFactAttribute : FactAttribute
{
    public PurchaseSqlFactAttribute()
    {
        if(Environment.GetEnvironmentVariable("COURSEFLOW_RUN_PURCHASE_SQL_TESTS")!="1")
            Skip="Set COURSEFLOW_RUN_PURCHASE_SQL_TESTS=1 to run against an isolated SQL Server test database.";
    }
}

public sealed class PurchaseSqlTests
{
    private static ClaimsPrincipal Actor(int id,string role="User") => new(new ClaimsIdentity(
        [new(ClaimTypes.NameIdentifier,id.ToString()),new(ClaimTypes.Role,role)],"test"));
    private static PurchaseService Service(AppDbContext db,FakeGateway gateway) => new(db,gateway,
        Microsoft.Extensions.Options.Options.Create(new PayOSPaymentOptions()),TimeProvider.System);

    [PurchaseSqlFact]
    public async Task Staff_support_restores_only_paid_access_and_does_not_bypass_payment_or_account_roles()
    {
        await using var fixture = await SqlFixture.CreateAsync(100000);
        await using var db = fixture.Db();
        var enrollments = new EnrollmentService(db, null!, TimeProvider.System);
        var input = new SupportEnrollmentDto { StudentId = fixture.StudentId, CourseId = fixture.CourseId };
        foreach (var role in new[] { "Instructor", "User" })
            Assert.Equal(BusinessError.Forbidden, (await Assert.ThrowsAsync<BusinessException>(() =>
                enrollments.SupportEnrollAsync(input, Actor(999, role), default))).Error);
        Assert.Equal(BusinessError.Conflict, (await Assert.ThrowsAsync<BusinessException>(() =>
            enrollments.SupportEnrollAsync(input, Actor(999, "Staff"), default))).Error);
        Assert.Empty(await db.Enrollments.ToListAsync());
        var purchase = await Service(db, new FakeGateway()).CreateAsync(new CreatePurchaseDto {
            CourseId=fixture.CourseId, BuyerName="Học viên", BuyerPhone="0901234567", BuyerAddress="Địa chỉ QA"
        }, Actor(fixture.StudentId), default);
        Assert.Equal(BusinessError.Conflict, (await Assert.ThrowsAsync<BusinessException>(() =>
            enrollments.SupportEnrollAsync(input, Actor(999, "Staff"), default))).Error);
        await DemoService(db, new FakeGateway()).ConfirmAsync(purchase.Id, Actor(fixture.StudentId), default);
        await enrollments.CancelAsync(fixture.CourseId, Actor(fixture.StudentId), default);
        var restored = await enrollments.SupportEnrollAsync(input, Actor(999, "Staff"), default);
        Assert.Equal(fixture.StudentId, restored.StudentId);
        Assert.Single(await db.Enrollments.ToListAsync());
        Assert.Equal(PurchaseStatus.Paid, (await db.CoursePurchases.SingleAsync()).Status);
        Assert.Equal(BusinessError.Conflict, (await Assert.ThrowsAsync<BusinessException>(() =>
            enrollments.SupportEnrollAsync(input, Actor(999, "Admin"), default))).Error);
        await enrollments.CancelAsync(fixture.CourseId, Actor(fixture.StudentId), default);
        db.ChangeTracker.Clear();
        (await db.Users.SingleAsync()).Role="Staff";
        await db.SaveChangesAsync();
        Assert.Equal(BusinessError.Forbidden, (await Assert.ThrowsAsync<BusinessException>(() =>
            enrollments.SupportEnrollAsync(input, Actor(999, "Staff"), default))).Error);
        Assert.Empty(await db.Enrollments.ToListAsync());
    }

    [PurchaseSqlFact]
    public async Task Paid_course_is_locked_until_verified_then_granted_once_and_bill_keeps_snapshot()
    {
        await using var fixture=await SqlFixture.CreateAsync(199000.50m);
        await using var db=fixture.Db();
        var gateway=new FakeGateway();var service=Service(db,gateway);var actor=Actor(fixture.StudentId);
        var input=new CreatePurchaseDto {CourseId=fixture.CourseId,BuyerName="Học viên thử nghiệm",BuyerPhone="0901234567",BuyerAddress="Địa chỉ ban đầu"};
        var enrollments=new EnrollmentService(db,null!,TimeProvider.System);
        var locked=await Assert.ThrowsAsync<BusinessException>(()=>enrollments.EnrollAsync(new EnrollCourseDto {CourseId=fixture.CourseId},actor,default));
        Assert.Equal(BusinessError.Conflict,locked.Error);
        Assert.Empty(await db.Enrollments.ToListAsync());
        var order=await service.CreateAsync(input,actor,default);
        Assert.Equal(199001,order.Amount);Assert.Equal(PurchaseStatus.Pending,order.Status);
        Assert.Equal(order.Id,(await service.CreateAsync(input,actor,default)).Id);
        Assert.Single(await db.CoursePurchases.ToListAsync());
        await service.CreatePaymentLinkAsync(order.Id,actor,default);
        Assert.Empty(await db.Enrollments.ToListAsync());
        await Assert.ThrowsAsync<BusinessException>(()=>service.GetAsync(order.Id,Actor(fixture.StudentId+999),default));
        var course=await db.Courses.SingleAsync(c=>c.Id==fixture.CourseId);course.Title="Tên mới";course.Price=900000;
        await db.SaveChangesAsync();
        gateway.Paid=true;
        // Two webhook/polling workers may finish together; only one enrollment is committed.
        await using(var db1=fixture.Db()) await using(var db2=fixture.Db())
            await Task.WhenAll(Service(db1,gateway).SyncAsync(order.Id,actor,default),Service(db2,gateway).SyncAsync(order.Id,actor,default));
        var paid=await service.GetAsync(order.Id,actor,default);
        Assert.Equal(PurchaseStatus.Paid,paid.Status);Assert.Equal(199001,paid.Amount);Assert.Equal("Khóa học gốc",paid.CourseTitle);
        Assert.Single(await db.Enrollments.AsNoTracking().ToListAsync());
        using var notice=JsonDocument.Parse("{}");
        await service.ReceiveWebhookAsync(notice.RootElement,default);
        await service.ReceiveWebhookAsync(notice.RootElement,default);
        var after=await service.GetAsync(order.Id,actor,default);
        Assert.Equal(paid.PaidAt,after.PaidAt);Assert.Single(await db.Enrollments.AsNoTracking().ToListAsync());
        // A paid learner who cancelled enrollment can restore access without another charge.
        db.ChangeTracker.Clear();db.Enrollments.RemoveRange(await db.Enrollments.ToListAsync());await db.SaveChangesAsync();
        Assert.Equal(order.Id,(await service.CreateAsync(input,actor,default)).Id);
        Assert.Single(await db.Enrollments.ToListAsync());
        Assert.Contains("ĐÃ THANH TOÁN",PurchaseInvoice.Render(after));
    }

    [PurchaseSqlFact]
    public async Task Free_course_has_zero_bill_and_enrollment_without_contacting_payOS()
    {
        await using var fixture=await SqlFixture.CreateAsync(0);
        await using var db=fixture.Db();var gateway=new FakeGateway();
        foreach (var contact in new[] { (Phone: "", Address: "Địa chỉ thử nghiệm"), (Phone: "0901234567", Address: "   "),
            (Phone: "09012345678", Address: "Địa chỉ thử nghiệm"), (Phone: "090123456!", Address: "Địa chỉ thử nghiệm") })
        {
            var error = await Assert.ThrowsAsync<BusinessException>(() => Service(db,gateway).CreateAsync(
                new CreatePurchaseDto {CourseId=fixture.CourseId,BuyerName="Khách miễn phí",BuyerPhone=contact.Phone,BuyerAddress=contact.Address},Actor(fixture.StudentId),default));
            Assert.Equal(BusinessError.InvalidInput,error.Error);
            Assert.Empty(await db.CoursePurchases.ToListAsync());
            Assert.Empty(await db.Enrollments.ToListAsync());
        }
        var bill=await Service(db,gateway).CreateAsync(new CreatePurchaseDto {CourseId=fixture.CourseId,BuyerName="Khách miễn phí",BuyerPhone="0901234567",BuyerAddress=" Địa chỉ thử nghiệm "},Actor(fixture.StudentId),default);
        Assert.Equal(PurchaseStatus.Paid,bill.Status);Assert.Equal(0,bill.Amount);Assert.Equal("FREE",bill.PaymentReference);
        Assert.Equal("0901234567",bill.BuyerPhone);Assert.Equal("Địa chỉ thử nghiệm",bill.BuyerAddress);
        Assert.Null(gateway.Last);Assert.Single(await db.Enrollments.ToListAsync());
    }

    [PurchaseSqlFact]
    public async Task Signed_webhook_recovers_when_payOS_created_link_before_local_save()
    {
        await using var fixture=await SqlFixture.CreateAsync(20000);
        await using var db=fixture.Db();var gateway=new FakeGateway();var service=Service(db,gateway);var actor=Actor(fixture.StudentId);
        var order=await service.CreateAsync(new CreatePurchaseDto {CourseId=fixture.CourseId,BuyerName="Khách phục hồi",BuyerPhone="0901234567",BuyerAddress="Địa chỉ thử nghiệm"},actor,default);
        await service.CreatePaymentLinkAsync(order.Id,actor,default);
        db.ChangeTracker.Clear();var stored=await db.CoursePurchases.SingleAsync();stored.PaymentLinkId=null;stored.QrPayload=null;await db.SaveChangesAsync();
        gateway.Paid=true;
        using var notice=JsonDocument.Parse("{}");await service.ReceiveWebhookAsync(notice.RootElement,default);
        var paid=await service.GetAsync(order.Id,actor,default);
        Assert.Equal(PurchaseStatus.Paid,paid.Status);Assert.Single(await db.Enrollments.ToListAsync());
        Assert.Equal("test-link",(await db.CoursePurchases.AsNoTracking().SingleAsync()).PaymentLinkId);
    }

    private static DemoPaymentService DemoService(AppDbContext db, FakeGateway gateway) => new(db,Service(db,gateway),
        Microsoft.Extensions.Options.Options.Create(new DemoPaymentOptions {Enabled=true}),new DemoHostEnvironment("Development"),TimeProvider.System);

    [PurchaseSqlFact]
    public async Task Demo_confirmation_grants_access_once_without_payOS_and_preserves_the_bill()
    {
        await using var fixture=await SqlFixture.CreateAsync(100000);
        await using var db=fixture.Db();var gateway=new FakeGateway();var actor=Actor(fixture.StudentId);
        var original=await Service(db,gateway).CreateAsync(new CreatePurchaseDto {CourseId=fixture.CourseId,BuyerName="Khách demo",BuyerPhone="0901234567",BuyerAddress="Địa chỉ demo"},actor,default);
        Assert.Empty(await db.Enrollments.ToListAsync());
        var hidden=await Assert.ThrowsAsync<BusinessException>(()=>DemoService(db,gateway).ConfirmAsync(original.Id,Actor(fixture.StudentId+999),default));
        Assert.Equal(BusinessError.NotFound,hidden.Error);
        await using(var first=fixture.Db()) await using(var second=fixture.Db())
            await Task.WhenAll(DemoService(first,gateway).ConfirmAsync(original.Id,actor,default),DemoService(second,gateway).ConfirmAsync(original.Id,actor,default));
        var paid=await Service(db,gateway).GetAsync(original.Id,actor,default);
        Assert.Equal(PurchaseStatus.Paid,paid.Status);Assert.NotNull(paid.PaidAt);
        Assert.Equal($"DEMO-{original.OrderCode}",paid.PaymentReference);
        Assert.Equal(original.Amount,paid.Amount);Assert.Equal(original.CourseTitle,paid.CourseTitle);
        Assert.Equal(original.BuyerName,paid.BuyerName);Assert.Equal(original.BuyerPhone,paid.BuyerPhone);Assert.Equal(original.BuyerAddress,paid.BuyerAddress);
        Assert.Single(await db.CoursePurchases.AsNoTracking().ToListAsync());
        Assert.Single(await db.Enrollments.AsNoTracking().ToListAsync());Assert.Null(gateway.Last);
        await using(var retry=fixture.Db())
            Assert.Equal(paid.PaidAt,(await DemoService(retry,gateway).ConfirmAsync(original.Id,actor,default)).PaidAt);
        Assert.Single(await db.Enrollments.AsNoTracking().ToListAsync());
        Assert.Contains("Thanh toán demo",System.Net.WebUtility.HtmlDecode(PurchaseInvoice.Render(paid)));
    }

    [PurchaseSqlFact]
    public async Task Closed_demo_purchases_cannot_grant_access()
    {
        await using var fixture=await SqlFixture.CreateAsync(100000);
        await using var db=fixture.Db();var gateway=new FakeGateway();var actor=Actor(fixture.StudentId);
        var order=await Service(db,gateway).CreateAsync(new CreatePurchaseDto {CourseId=fixture.CourseId,BuyerName="Khách demo",BuyerPhone="0901234567",BuyerAddress="Địa chỉ demo"},actor,default);
        foreach(var status in new[]{PurchaseStatus.Cancelled,PurchaseStatus.Expired})
        {
            db.ChangeTracker.Clear();var stored=await db.CoursePurchases.SingleAsync(p=>p.Id==order.Id);stored.Status=status;await db.SaveChangesAsync();
            var error=await Assert.ThrowsAsync<BusinessException>(()=>DemoService(db,gateway).ConfirmAsync(order.Id,actor,default));
            Assert.Equal(BusinessError.Conflict,error.Error);Assert.Empty(await db.Enrollments.ToListAsync());
        }
    }

    [PurchaseSqlFact]
    public async Task User_and_Admin_cancel_pending_orders_and_both_lists_read_the_SQL_status()
    {
        await using var fixture=await SqlFixture.CreateAsync(100000);
        await using var db=fixture.Db();var gateway=new FakeGateway();var service=Service(db,gateway);var actor=Actor(fixture.StudentId);
        var input=new CreatePurchaseDto {CourseId=fixture.CourseId,BuyerName="Khách hủy đơn",BuyerPhone="0901234567",BuyerAddress="Địa chỉ bill"};
        var original=await service.CreateAsync(input,actor,default);
        var hidden=await Assert.ThrowsAsync<BusinessException>(()=>service.CancelAsync(original.Id,Actor(fixture.StudentId+999),default));
        Assert.Equal(BusinessError.NotFound,hidden.Error);
        var denied=await Assert.ThrowsAsync<BusinessException>(()=>service.CancelAsync(original.Id,Actor(fixture.StudentId,"Staff"),default));
        Assert.Equal(BusinessError.NotFound,denied.Error);
        var cancelled=await service.CancelAsync(original.Id,actor,default);
        Assert.Equal(PurchaseStatus.Cancelled,cancelled.Status);Assert.Null(cancelled.PaidAt);
        Assert.Equal(original.Amount,cancelled.Amount);Assert.Equal(original.BuyerPhone,cancelled.BuyerPhone);Assert.Equal(original.BuyerAddress,cancelled.BuyerAddress);
        Assert.Equal(PurchaseStatus.Cancelled,(await service.CancelAsync(original.Id,actor,default)).Status);
        Assert.Equal(PurchaseStatus.Cancelled,(await service.ListAsync(actor,false,1,default)).Single().Status);
        var admin=Actor(999,"Admin");
        Assert.Equal(PurchaseStatus.Cancelled,(await service.ListAsync(admin,true,1,default)).Single().Status);
        var replacement=await service.CreateAsync(input,actor,default);
        Assert.NotEqual(original.Id,replacement.Id);
        await service.CancelAsync(replacement.Id,admin,default);
        await using var verify=fixture.Db();
        Assert.Equal(2,await verify.CoursePurchases.CountAsync());
        Assert.All(await verify.CoursePurchases.ToListAsync(),p=>Assert.Equal(PurchaseStatus.Cancelled,p.Status));
        Assert.Empty(await verify.Enrollments.ToListAsync());Assert.Equal(0,gateway.CancelCalls);
    }

    [PurchaseSqlFact]
    public async Task Cancelling_a_payOS_link_updates_SQL_and_keeps_the_bill_history()
    {
        await using var fixture=await SqlFixture.CreateAsync(100000);
        await using var db=fixture.Db();var gateway=new FakeGateway();var service=Service(db,gateway);var actor=Actor(fixture.StudentId);
        var order=await service.CreateAsync(new CreatePurchaseDto {CourseId=fixture.CourseId,BuyerName="Khách payOS",BuyerPhone="0901234567",BuyerAddress="Địa chỉ bill"},actor,default);
        await service.CreatePaymentLinkAsync(order.Id,actor,default);
        var cancelled=await service.CancelAsync(order.Id,actor,default);
        Assert.True(gateway.Cancelled);Assert.Equal(1,gateway.CancelCalls);Assert.Equal(PurchaseStatus.Cancelled,cancelled.Status);
        Assert.Null(cancelled.QrCodeDataUrl);
        await using var verify=fixture.Db();var stored=await verify.CoursePurchases.SingleAsync();
        Assert.Equal(PurchaseStatus.Cancelled,stored.Status);Assert.Equal("test-link",stored.PaymentLinkId);
        Assert.Empty(await verify.Enrollments.ToListAsync());
        Assert.Equal(PurchaseStatus.Cancelled,(await service.SyncAsync(order.Id,actor,default)).Status);
    }

    [PurchaseSqlFact]
    public async Task Failed_gateway_cancellation_keeps_SQL_pending_and_payment_race_grants_access()
    {
        await using var fixture=await SqlFixture.CreateAsync(100000);
        await using var db=fixture.Db();var gateway=new FakeGateway();var service=Service(db,gateway);var actor=Actor(fixture.StudentId);
        var order=await service.CreateAsync(new CreatePurchaseDto {CourseId=fixture.CourseId,BuyerName="Khách payOS",BuyerPhone="0901234567",BuyerAddress="Địa chỉ bill"},actor,default);
        await service.CreatePaymentLinkAsync(order.Id,actor,default);
        gateway.CancelFails=true;
        var failed=await Assert.ThrowsAsync<BusinessException>(()=>service.CancelAsync(order.Id,actor,default));
        Assert.Equal(BusinessError.Conflict,failed.Error);
        await using(var verify=fixture.Db())
        {
            Assert.Equal(PurchaseStatus.Pending,(await verify.CoursePurchases.SingleAsync()).Status);
            Assert.Empty(await verify.Enrollments.ToListAsync());
        }
        gateway.CancelFails=false;gateway.Paid=true;
        var paidRace=await Assert.ThrowsAsync<BusinessException>(()=>service.CancelAsync(order.Id,actor,default));
        Assert.Equal(BusinessError.Conflict,paidRace.Error);
        await using(var verify=fixture.Db())
        {
            var paid=await verify.CoursePurchases.SingleAsync();Assert.Equal(PurchaseStatus.Paid,paid.Status);Assert.NotNull(paid.PaidAt);
            Assert.Single(await verify.Enrollments.ToListAsync());
        }
        await Assert.ThrowsAsync<BusinessException>(()=>service.CancelAsync(order.Id,Actor(999,"Admin"),default));
        Assert.Single(await db.Enrollments.AsNoTracking().ToListAsync());
    }

    [PurchaseSqlFact]
    public async Task Cancellation_and_demo_confirmation_cannot_both_change_the_same_pending_order()
    {
        await using var fixture=await SqlFixture.CreateAsync(100000);
        await using var db=fixture.Db();var gateway=new FakeGateway();var actor=Actor(fixture.StudentId);
        var order=await Service(db,gateway).CreateAsync(new CreatePurchaseDto {CourseId=fixture.CourseId,BuyerName="Khách demo",BuyerPhone="0901234567",BuyerAddress="Địa chỉ bill"},actor,default);
        static async Task<BusinessError?> Attempt(Func<Task<PurchaseView>> action)
        {
            try {await action();return null;} catch(BusinessException error) {return error.Error;}
        }
        await using var cancelDb=fixture.Db();await using var demoDb=fixture.Db();
        var results=await Task.WhenAll(Attempt(()=>Service(cancelDb,gateway).CancelAsync(order.Id,actor,default)),
            Attempt(()=>DemoService(demoDb,gateway).ConfirmAsync(order.Id,actor,default)));
        Assert.Single(results,result=>result is null);Assert.Contains(BusinessError.Conflict,results);
        await using var verify=fixture.Db();var stored=await verify.CoursePurchases.SingleAsync();
        Assert.Contains(stored.Status,new[]{PurchaseStatus.Paid,PurchaseStatus.Cancelled});
        Assert.Equal(stored.Status==PurchaseStatus.Paid?1:0,await verify.Enrollments.CountAsync());
    }

    private sealed class SqlFixture : IAsyncDisposable
    {
        private readonly string _name="CourseFlow_PayOS_Test_"+Guid.NewGuid().ToString("N");
        private readonly string _server=Environment.GetEnvironmentVariable("COURSEFLOW_TEST_SQL_SERVER")??@".\SQLEXPRESS";
        public int StudentId {get;private set;}
        public int CourseId {get;private set;}
        public AppDbContext Db() => new(new DbContextOptionsBuilder<AppDbContext>().UseSqlServer(
            new Microsoft.Data.SqlClient.SqlConnectionStringBuilder {DataSource=_server,InitialCatalog=_name,
                IntegratedSecurity=true,TrustServerCertificate=true,ConnectTimeout=10}.ConnectionString).Options);
        public static async Task<SqlFixture> CreateAsync(decimal price)
        {
            var fixture=new SqlFixture();
            try {
                await using var db=fixture.Db();await db.Database.MigrateAsync();
                var user=new User {FullName="Student",Email="student@example.test",PasswordHash="test-only-hash",Role="User"};
                var category=new Category {Name="Test category"};db.AddRange(user,category);await db.SaveChangesAsync();
                var course=new Course {Title="Khóa học gốc",Price=price,CategoryId=category.Id};db.Courses.Add(course);await db.SaveChangesAsync();
                fixture.StudentId=user.Id;fixture.CourseId=course.Id;return fixture;
            } catch {await fixture.DisposeAsync();throw;}
        }
        public async ValueTask DisposeAsync()
        {
            if(!System.Text.RegularExpressions.Regex.IsMatch(_name,@"\ACourseFlow_PayOS_Test_[a-f0-9]{32}\z"))throw new InvalidOperationException("Unsafe test database name");
            await using var db=Db();await db.Database.EnsureDeletedAsync();
        }
    }
}
