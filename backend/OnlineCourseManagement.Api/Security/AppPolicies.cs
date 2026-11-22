using Microsoft.AspNetCore.Authorization;
using OnlineCourseManagement.Models;

namespace OnlineCourseManagement.Security;

public static class AppPolicies
{
    public const string CatalogManagement = "CatalogManagement";
    public const string CourseEditing = "CourseEditing";
    public const string AccountAdministration = "AccountAdministration";
    public const string StudentSupport = "StudentSupport";
    public const string Learning = "Learning";
    public const string ManageCourse = "ManageCourse";

    public static void Configure(AuthorizationOptions options)
    {
        options.AddPolicy(CatalogManagement, policy => policy.RequireAuthenticatedUser()
            .RequireRole(AppRoles.Admin, AppRoles.Staff).RequireClaim(AppPermissions.ClaimType, AppPermissions.CatalogManage));
        options.AddPolicy(CourseEditing, policy => policy.RequireAuthenticatedUser()
            .RequireRole(AppRoles.Admin, AppRoles.Staff, AppRoles.Instructor).RequireClaim(AppPermissions.ClaimType, AppPermissions.CourseWrite));
        options.AddPolicy(AccountAdministration, policy => policy.RequireAuthenticatedUser()
            .RequireRole(AppRoles.Admin).RequireClaim(AppPermissions.ClaimType, AppPermissions.AccountsManage));
        options.AddPolicy(StudentSupport, policy => policy.RequireAuthenticatedUser()
            .RequireRole(AppRoles.Admin, AppRoles.Staff).RequireClaim(AppPermissions.ClaimType, AppPermissions.StudentsSupport));
        options.AddPolicy(Learning, policy => policy.RequireAuthenticatedUser()
            .RequireRole(AppRoles.User).RequireClaim(AppPermissions.ClaimType, AppPermissions.Learning));
        options.AddPolicy(ManageCourse, policy => policy.RequireAuthenticatedUser()
            .RequireClaim(AppPermissions.ClaimType, AppPermissions.CourseWrite)
            .AddRequirements(new ManageCourseRequirement()));
    }
}

public sealed class ManageCourseRequirement : IAuthorizationRequirement { }

public sealed class ManageCourseHandler : AuthorizationHandler<ManageCourseRequirement, Course>
{
    protected override Task HandleRequirementAsync(AuthorizationHandlerContext context,
        ManageCourseRequirement requirement, Course course)
    {
        if (context.User.Identity?.IsAuthenticated == true && AppRoles.CanManageCourse(context.User, course))
            context.Succeed(requirement);
        return Task.CompletedTask;
    }
}
