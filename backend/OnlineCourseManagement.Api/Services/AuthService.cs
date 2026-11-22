using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using OnlineCourseManagement.Data;
using OnlineCourseManagement.DTOs;
using OnlineCourseManagement.Exceptions;
using OnlineCourseManagement.Models;
using OnlineCourseManagement.Security;

namespace OnlineCourseManagement.Services;

public sealed class AuthService(AppDbContext db, IPasswordHasher<User> passwords, JwtService jwt) : IAuthService
{
    public async Task<UserResponseDto> RegisterAsync(RegisterDto input, CancellationToken token)
    {
        if (AppRoles.Normalize(input.Role) != AppRoles.User)
            throw BusinessException.Invalid("Đăng ký công khai chỉ tạo User (sinh viên).");
        var email = input.Email.Trim().ToLowerInvariant();
        if (await db.Users.AnyAsync(user => user.Email == email, token))
            throw BusinessException.Conflict("Email đã được sử dụng.");
        var user = new User { FullName = input.FullName.Trim(), Email = email, Role = AppRoles.User };
        user.PasswordHash = passwords.HashPassword(user, input.Password);
        db.Users.Add(user);
        await db.SaveChangesAsync(token);
        return Map(user);
    }

    public async Task<LoginResponseDto> LoginAsync(LoginDto input, CancellationToken token)
    {
        var email = input.Email.Trim().ToLowerInvariant();
        var user = await db.Users.SingleOrDefaultAsync(user => user.Email == email, token);
        if (user == null) throw InvalidLogin();
        PasswordVerificationResult result;
        try { result = passwords.VerifyHashedPassword(user, user.PasswordHash, input.Password); }
        catch (FormatException) { throw InvalidLogin(); }
        if (result == PasswordVerificationResult.Failed) throw InvalidLogin();
        if (result == PasswordVerificationResult.SuccessRehashNeeded)
        {
            user.PasswordHash = passwords.HashPassword(user, input.Password);
            await db.SaveChangesAsync(token);
        }
        return new("Đăng nhập thành công", jwt.GenerateToken(user), Map(user));
    }

    public async Task<UserResponseDto> GetProfileAsync(ClaimsPrincipal actor, CancellationToken token)
    {
        var id = actor.RequireUserId();
        return await db.Users.AsNoTracking().Where(user => user.Id == id).Select(user => new UserResponseDto
        {
            Id = user.Id, FullName = user.FullName, Email = user.Email, Role = user.Role, CreatedAt = user.CreatedAt
        }).SingleOrDefaultAsync(token) ?? throw BusinessException.Unauthenticated();
    }

    private static BusinessException InvalidLogin() => new(BusinessError.Unauthenticated, "Email hoặc mật khẩu không đúng.");
    private static UserResponseDto Map(User user) => new()
    {
        Id = user.Id, FullName = user.FullName, Email = user.Email, Role = user.Role, CreatedAt = user.CreatedAt
    };
}
