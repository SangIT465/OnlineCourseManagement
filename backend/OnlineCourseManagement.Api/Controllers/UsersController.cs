using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OnlineCourseManagement.DTOs;
using OnlineCourseManagement.DTOs.Common;
using OnlineCourseManagement.Security;
using OnlineCourseManagement.Services;

namespace OnlineCourseManagement.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = AppPolicies.StudentSupport)]
public sealed class UsersController(IUserService users) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResult<UserResponseDto>>> GetAll(
        [FromQuery] UserQueryParameters input, CancellationToken token) =>
        Ok(await users.GetAllAsync(input, User, token));

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id, CancellationToken token) =>
        Ok(await users.GetByIdAsync(id, User, token));

    [HttpPost]
    [Authorize(Policy = AppPolicies.AccountAdministration)]
    public async Task<IActionResult> Create([FromBody] CreateUserDto input, CancellationToken token)
    {
        var user = await users.CreateAsync(input, token);
        return CreatedAtAction(nameof(GetById), new { id = user.Id },
            new { user.Id, user.FullName, user.Email, user.Role });
    }

    [HttpPut("{id:int}/role")]
    [Authorize(Policy = AppPolicies.AccountAdministration)]
    public async Task<IActionResult> UpdateRole(int id, [FromBody] UpdateUserRoleDto input, CancellationToken token)
    {
        var user = await users.UpdateRoleAsync(id, input, User, token);
        return Ok(new { message = "Cập nhật vai trò thành công", user.Id, user.Role });
    }

    [HttpPut("{id:int}/reset-password")]
    public async Task<IActionResult> ResetPassword(int id, [FromBody] ResetPasswordDto input, CancellationToken token)
    {
        await users.ResetPasswordAsync(id, input.NewPassword, User, token);
        return Ok(new { message = "Đặt lại mật khẩu thành công. Các phiên đăng nhập cũ đã hết hiệu lực." });
    }

    [HttpDelete("{id:int}")]
    [Authorize(Policy = AppPolicies.AccountAdministration)]
    public async Task<IActionResult> Delete(int id, CancellationToken token)
    {
        await users.DeleteAsync(id, User, token);
        return Ok(new { message = "Xóa tài khoản thành công" });
    }
}
