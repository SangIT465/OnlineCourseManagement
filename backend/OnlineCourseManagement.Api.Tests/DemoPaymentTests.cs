using System.Security.Claims;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using OnlineCourseManagement.Exceptions;
using OnlineCourseManagement.Models;
using OnlineCourseManagement.Options;
using OnlineCourseManagement.Services;

namespace OnlineCourseManagement.Api.Tests;

public sealed class DemoPaymentTests
{
    private static ClaimsPrincipal Actor(string role = "User") => new(new ClaimsIdentity(
        [new(ClaimTypes.NameIdentifier,"1"),new(ClaimTypes.Role,role)],"test"));

    [Theory]
    [InlineData("Production",true)]
    [InlineData("Staging",true)]
    [InlineData("Development",false)]
    public async Task Demo_is_unavailable_outside_enabled_development(string environment, bool enabled)
    {
        var service = new DemoPaymentService(null!,null!,Microsoft.Extensions.Options.Options.Create(new DemoPaymentOptions {Enabled=enabled}),
            new DemoHostEnvironment(environment),TimeProvider.System);
        Assert.False(service.IsEnabled);
        var error = await Assert.ThrowsAsync<BusinessException>(()=>service.ConfirmAsync(1,Actor(),default));
        Assert.Equal(BusinessError.NotFound,error.Error);
    }

    [Theory]
    [InlineData("Admin")]
    [InlineData("Staff")]
    [InlineData("Instructor")]
    public async Task Only_the_student_can_confirm_a_demo_purchase(string role)
    {
        var service = new DemoPaymentService(null!,null!,Microsoft.Extensions.Options.Options.Create(new DemoPaymentOptions {Enabled=true}),
            new DemoHostEnvironment("Development"),TimeProvider.System);
        var error = await Assert.ThrowsAsync<BusinessException>(()=>service.ConfirmAsync(1,Actor(role),default));
        Assert.Equal(BusinessError.Forbidden,error.Error);
    }

    [Theory]
    [InlineData("User","PendingPayment",true)]
    [InlineData("Admin","PendingPayment",false)]
    [InlineData("User","Paid",false)]
    [InlineData("User","Cancelled",false)]
    [InlineData("User","Expired",false)]
    public void Demo_button_is_available_only_for_a_pending_student_purchase(string role,string status,bool expected)
    {
        var purchases = new PurchaseService(null!,new FakeGateway(),Microsoft.Extensions.Options.Options.Create(new PayOSPaymentOptions()),TimeProvider.System);
        var service = new DemoPaymentService(null!,purchases,Microsoft.Extensions.Options.Options.Create(new DemoPaymentOptions {Enabled=true}),
            new DemoHostEnvironment("Development"),TimeProvider.System);
        Assert.Equal(expected,service.CanConfirm(Actor(role),purchases.View(new CoursePurchase {Status=status})));
    }
}

internal sealed class DemoHostEnvironment(string name) : IHostEnvironment
{
    public string EnvironmentName { get; set; } = name;
    public string ApplicationName { get; set; } = "DemoPaymentTests";
    public string ContentRootPath { get; set; } = AppContext.BaseDirectory;
    public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
}
