using System.Security.Claims;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using OnlineCourseManagement.Data;

namespace OnlineCourseManagement.Security;

public sealed class CurrentSessionJwtEvents(AppDbContext db) : JwtBearerEvents
{
    public override async Task TokenValidated(TokenValidatedContext context)
    {
        var principal = context.Principal;
        if (!int.TryParse(principal?.FindFirstValue(ClaimTypes.NameIdentifier), out var userId) || userId <= 0)
        {
            context.Fail("Tài khoản không hợp lệ.");
            return;
        }
        var account = await db.Users.AsNoTracking().Where(user => user.Id == userId)
            .Select(user => new { user.Role, user.SecurityStamp })
            .SingleOrDefaultAsync(context.HttpContext.RequestAborted);
        if (account == null || AppRoles.Normalize(account.Role) == null ||
            principal!.FindFirstValue(ClaimTypes.Role) != account.Role ||
            principal.FindFirstValue(AppRoles.SecurityStampClaim) != account.SecurityStamp ||
            AppPermissions.ForRole(account.Role).Any(permission => !principal.HasClaim(AppPermissions.ClaimType, permission)))
            context.Fail("Phiên đăng nhập không còn hiệu lực. Vui lòng đăng nhập lại.");
    }
}
