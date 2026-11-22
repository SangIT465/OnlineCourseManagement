using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.DependencyInjection;
using OnlineCourseManagement.Models;
using OnlineCourseManagement.Security;

namespace OnlineCourseManagement.Api.Tests;

public sealed class AuthorizationTests
{
    private static ClaimsPrincipal Actor(string role, bool permissions = true) => new(new ClaimsIdentity(
        new[] { new Claim(ClaimTypes.NameIdentifier, "12"), new Claim(ClaimTypes.Role, role) }
            .Concat(permissions ? AppPermissions.ForRole(role).Select(p => new Claim(AppPermissions.ClaimType, p)) : []), "test"));

    private static ServiceProvider Services() => new ServiceCollection().AddLogging()
        .AddAuthorization(AppPolicies.Configure).AddSingleton<IAuthorizationHandler, ManageCourseHandler>().BuildServiceProvider();

    [Theory]
    [InlineData("Admin", 99, true)]
    [InlineData("Staff", 99, true)]
    [InlineData("Instructor", 12, true)]
    [InlineData("Instructor", 99, false)]
    [InlineData("User", 12, false)]
    public async Task Course_policy_checks_role_permission_and_teaching_assignment(string role, int instructorId, bool allowed)
    {
        await using var services = Services();
        var result = await services.GetRequiredService<IAuthorizationService>().AuthorizeAsync(
            Actor(role), new Course { Id = 1, InstructorId = instructorId, StaffId = 12 }, AppPolicies.ManageCourse);
        Assert.Equal(allowed, result.Succeeded);
    }

    [Fact]
    public async Task Role_without_required_permission_is_rejected()
    {
        await using var services = Services();
        var result = await services.GetRequiredService<IAuthorizationService>().AuthorizeAsync(
            Actor(AppRoles.Admin, permissions: false), new Course(), AppPolicies.ManageCourse);
        Assert.False(result.Succeeded);
    }

    [Theory]
    [InlineData("Admin", "AccountAdministration", true)]
    [InlineData("Staff", "AccountAdministration", false)]
    [InlineData("Instructor", "CatalogManagement", false)]
    [InlineData("Staff", "StudentSupport", true)]
    [InlineData("Instructor", "StudentSupport", false)]
    [InlineData("User", "Learning", true)]
    [InlineData("Instructor", "Learning", false)]
    public async Task Endpoint_policies_separate_account_support_catalog_and_learning(string role, string policy, bool allowed)
    {
        await using var services = Services();
        var result = await services.GetRequiredService<IAuthorizationService>().AuthorizeAsync(Actor(role), null, policy);
        Assert.Equal(allowed, result.Succeeded);
    }
}
