using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OnlineCourseManagement.Controllers;
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
    public async Task Paid_course_is_locked_until_verified_then_granted_once_and_bill_keeps_snapshot()
    {
        await using var fixture=await SqlFixture.CreateAsync(199000.50m);
        await using var db=fixture.Db();
        var gateway=new FakeGateway();var service=Service(db,gateway);var actor=Actor(fixture.StudentId);
        var input=new CreatePurchaseDto {CourseId=fixture.CourseId,BuyerName="Học viên thử nghiệm",BuyerAddress="Địa chỉ ban đầu"};
        var controller=new EnrollmentsController(db,null!) {ControllerContext=new ControllerContext {HttpContext=new DefaultHttpContext {User=actor}}};
        Assert.IsType<ConflictObjectResult>(await controller.Enroll(new EnrollCourseDto {CourseId=fixture.CourseId}));
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
        var bill=await Service(db,gateway).CreateAsync(new CreatePurchaseDto {CourseId=fixture.CourseId,BuyerName="Khách miễn phí"},Actor(fixture.StudentId),default);
        Assert.Equal(PurchaseStatus.Paid,bill.Status);Assert.Equal(0,bill.Amount);Assert.Equal("FREE",bill.PaymentReference);
        Assert.Null(gateway.Last);Assert.Single(await db.Enrollments.ToListAsync());
    }

    [PurchaseSqlFact]
    public async Task Signed_webhook_recovers_when_payOS_created_link_before_local_save()
    {
        await using var fixture=await SqlFixture.CreateAsync(20000);
        await using var db=fixture.Db();var gateway=new FakeGateway();var service=Service(db,gateway);var actor=Actor(fixture.StudentId);
        var order=await service.CreateAsync(new CreatePurchaseDto {CourseId=fixture.CourseId,BuyerName="Khách phục hồi"},actor,default);
        await service.CreatePaymentLinkAsync(order.Id,actor,default);
        db.ChangeTracker.Clear();var stored=await db.CoursePurchases.SingleAsync();stored.PaymentLinkId=null;stored.QrPayload=null;await db.SaveChangesAsync();
        gateway.Paid=true;
        using var notice=JsonDocument.Parse("{}");await service.ReceiveWebhookAsync(notice.RootElement,default);
        var paid=await service.GetAsync(order.Id,actor,default);
        Assert.Equal(PurchaseStatus.Paid,paid.Status);Assert.Single(await db.Enrollments.ToListAsync());
        Assert.Equal("test-link",(await db.CoursePurchases.AsNoTracking().SingleAsync()).PaymentLinkId);
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
