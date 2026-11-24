using System.Data;
using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using OnlineCourseManagement.Data;
using OnlineCourseManagement.DTOs;
using OnlineCourseManagement.DTOs.Common;
using OnlineCourseManagement.Exceptions;
using OnlineCourseManagement.Models;
using OnlineCourseManagement.Repositories;
using OnlineCourseManagement.Security;

namespace OnlineCourseManagement.Services;

public sealed class UserService(
    AppDbContext db, IUserRepository users, IPasswordHasher<User> passwords, TimeProvider time) : IUserService
{
    public async Task<PagedResult<UserResponseDto>> GetAllAsync(
        UserQueryParameters input, ClaimsPrincipal actor, CancellationToken token)
    {
        if (!string.IsNullOrWhiteSpace(input.Role))
            input.Role = AppRoles.Normalize(input.Role)
                ?? throw BusinessException.Invalid("Vai trò không hợp lệ.");
        if (!actor.IsInRole(AppRoles.Admin) && input.Role is not (null or AppRoles.User))
            throw BusinessException.Forbidden();

        // Directory scope always comes from the authenticated actor, never the request.
        input.AllowedRoles = actor.IsInRole(AppRoles.Admin) ? null : [AppRoles.User];
        var page = await users.GetAllAsync(input, token);
        return new(page.Items.Select(Map).ToList(), page.TotalCount, page.PageNumber, page.PageSize);
    }

    public async Task<UserResponseDto> GetByIdAsync(int id, ClaimsPrincipal actor, CancellationToken token)
    {
        var user = await users.GetByIdAsync(id, token)
            ?? throw BusinessException.NotFound("Không tìm thấy tài khoản");
        EnsureCanSupport(actor, user);
        return Map(user);
    }

    public async Task<UserResponseDto> CreateAsync(CreateUserDto input, CancellationToken token)
    {
        var role = NormalizeRole(input.Role);
        var email = input.Email.Trim().ToLowerInvariant();
        if (await db.Users.AnyAsync(user => user.Email == email, token))
            throw BusinessException.Conflict("Email đã tồn tại");

        var user = new User
        {
            FullName = input.FullName.Trim(), Email = email, Role = role,
            CreatedAt = time.GetUtcNow().UtcDateTime
        };
        user.PasswordHash = passwords.HashPassword(user, input.Password);
        db.Users.Add(user);
        try { await db.SaveChangesAsync(token); }
        catch (DbUpdateException) { throw BusinessException.Conflict("Không thể tạo tài khoản"); }
        return Map(user);
    }

    public async Task<UserResponseDto> UpdateRoleAsync(
        int id, UpdateUserRoleDto input, ClaimsPrincipal actor, CancellationToken token)
    {
        var role = NormalizeRole(input.Role);
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, token);
        var user = await db.FindForUpdateAsync(id, token)
            ?? throw BusinessException.NotFound("Tài khoản không tồn tại");

        if (actor.FindFirstValue(ClaimTypes.NameIdentifier) == id.ToString() && role != AppRoles.Admin)
            throw BusinessException.Invalid("Không thể tự hạ quyền Admin");
        if (user.Role == AppRoles.Admin && role != AppRoles.Admin &&
            await db.Users.CountAsync(account => account.Role == AppRoles.Admin, token) <= 1)
            throw BusinessException.Invalid("Phải giữ ít nhất một Admin");

        if (user.Role == AppRoles.Staff && role != AppRoles.Staff &&
            await db.Courses.AnyAsync(course => course.StaffId == id, token))
            throw BusinessException.Conflict("Hãy phân công lại các khóa học trước khi đổi vai trò nhân viên.");
        if (user.Role == AppRoles.Instructor && role != AppRoles.Instructor &&
            await db.Courses.AnyAsync(course => course.InstructorId == id, token))
            throw BusinessException.Conflict("Hãy phân công lại các khóa học trước khi đổi vai trò giảng viên.");

        if (user.Role != role) user.SecurityStamp = Guid.NewGuid().ToString("N");
        user.Role = role;
        await db.SaveChangesAsync(token);
        await transaction.CommitAsync(token);
        return Map(user);
    }

    public async Task ResetPasswordAsync(int id, string password, ClaimsPrincipal actor, CancellationToken token)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, token);
        var user = await db.FindForUpdateAsync(id, token)
            ?? throw BusinessException.NotFound("Không tìm thấy tài khoản");
        EnsureCanSupport(actor, user);
        if (string.IsNullOrWhiteSpace(password) || password.Length < 8)
            throw BusinessException.Invalid("Mật khẩu phải có ít nhất 8 ký tự");

        user.PasswordHash = passwords.HashPassword(user, password);
        user.SecurityStamp = Guid.NewGuid().ToString("N");
        await db.SaveChangesAsync(token);
        await transaction.CommitAsync(token);
    }

    public async Task DeleteAsync(int id, ClaimsPrincipal actor, CancellationToken token)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, token);
        var user = await db.FindForUpdateAsync(id, token)
            ?? throw BusinessException.NotFound("Không tìm thấy tài khoản");
        if (actor.FindFirstValue(ClaimTypes.NameIdentifier) == id.ToString())
            throw BusinessException.Invalid("Không thể tự xóa tài khoản");
        if (user.Role == AppRoles.Admin &&
            await db.Users.CountAsync(account => account.Role == AppRoles.Admin, token) <= 1)
            throw BusinessException.Invalid("Không thể xóa Admin cuối cùng");

        db.Users.Remove(user);
        try
        {
            await db.SaveChangesAsync(token);
            await transaction.CommitAsync(token);
        }
        catch (DbUpdateException)
        {
            throw BusinessException.Conflict("Tài khoản đang có dữ liệu liên quan, không thể xóa");
        }
    }

    private static string NormalizeRole(string role) =>
        AppRoles.Normalize(role) ?? throw BusinessException.Invalid("Vai trò không hợp lệ");

    private static void EnsureCanSupport(ClaimsPrincipal actor, User user)
    {
        if (!actor.IsInRole(AppRoles.Admin) && user.Role != AppRoles.User)
            throw BusinessException.Forbidden();
    }

    private static UserResponseDto Map(User user) => new()
    {
        Id = user.Id, FullName = user.FullName, Email = user.Email,
        Role = user.Role, CreatedAt = user.CreatedAt
    };
}
