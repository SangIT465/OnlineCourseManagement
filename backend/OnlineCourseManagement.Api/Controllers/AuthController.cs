using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OnlineCourseManagement.DTOs;
using OnlineCourseManagement.Security;
using OnlineCourseManagement.Services;

namespace OnlineCourseManagement.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(IAuthService authentication) : ControllerBase
{
    /// <summary>Register a student account. Privileged roles cannot be self-registered.</summary>
    [AllowAnonymous]
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterDto input, CancellationToken token)
    {
        var user = await authentication.RegisterAsync(input, token);
        return Ok(new { message = "Đăng ký thành công", user.Id, user.FullName, user.Email, user.Role });
    }

    /// <summary>Sign in and receive the JWT used by Authorize in Swagger or Postman.</summary>
    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<ActionResult<LoginResponseDto>> Login([FromBody] LoginDto input, CancellationToken token) =>
        Ok(await authentication.LoginAsync(input, token));

    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<UserResponseDto>> Me(CancellationToken token) =>
        Ok(await authentication.GetProfileAsync(User, token));

    [Authorize(Policy = AppPolicies.Learning)]
    [HttpGet("student-only")]
    [HttpGet("user-only")]
    public IActionResult StudentOnly() => Ok(new { message = "Bạn có quyền User (sinh viên)" });

    [Authorize(Policy = AppPolicies.AccountAdministration)]
    [HttpGet("admin-only")]
    public IActionResult AdminOnly() => Ok(new { message = "Bạn có quyền Admin" });
}
