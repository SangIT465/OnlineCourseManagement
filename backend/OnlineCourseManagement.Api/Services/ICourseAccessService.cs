using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using OnlineCourseManagement.Exceptions;
using OnlineCourseManagement.Models;
using OnlineCourseManagement.Security;

namespace OnlineCourseManagement.Services;

public interface ICourseAccessService
{
    Task<bool> CanManageAsync(ClaimsPrincipal actor, Course course);
    Task EnsureCanManageAsync(ClaimsPrincipal actor, Course course);
}

public sealed class CourseAccessService(IAuthorizationService authorization) : ICourseAccessService
{
    public async Task<bool> CanManageAsync(ClaimsPrincipal actor, Course course) =>
        (await authorization.AuthorizeAsync(actor, course, AppPolicies.ManageCourse)).Succeeded;

    public async Task EnsureCanManageAsync(ClaimsPrincipal actor, Course course)
    {
        if (!await CanManageAsync(actor, course)) throw BusinessException.Forbidden();
    }
}

public static class ActorIdentity
{
    public static int RequireUserId(this ClaimsPrincipal actor) =>
        int.TryParse(actor.FindFirstValue(ClaimTypes.NameIdentifier), out var id) && id > 0
            ? id : throw BusinessException.Unauthenticated();
}
