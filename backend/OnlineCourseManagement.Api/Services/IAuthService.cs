using System.Security.Claims;
using OnlineCourseManagement.DTOs;

namespace OnlineCourseManagement.Services;

public sealed record LoginResponseDto(string Message, string Token, UserResponseDto User);

public interface IAuthService
{
    Task<UserResponseDto> RegisterAsync(RegisterDto input, CancellationToken token);
    Task<LoginResponseDto> LoginAsync(LoginDto input, CancellationToken token);
    Task<UserResponseDto> GetProfileAsync(ClaimsPrincipal actor, CancellationToken token);
}
