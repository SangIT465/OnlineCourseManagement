using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OnlineCourseManagement.Data;
using OnlineCourseManagement.DTOs;
using OnlineCourseManagement.DTOs.Common;
using OnlineCourseManagement.Models;
using OnlineCourseManagement.Services;
using System.Security.Claims;
using System.Data;
using OnlineCourseManagement.Security;

namespace OnlineCourseManagement.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = AppRoles.CatalogManagers)]
    public class UsersController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IPasswordHasher<User> _hasher;
        private readonly IUserService _userService;

        public UsersController(
            AppDbContext context,
            IPasswordHasher<User> hasher,
            IUserService userService)
        {
            _context = context;
            _hasher = hasher;
            _userService = userService;
        }

        // GET: api/users
        [HttpGet]
        public async Task<ActionResult<PagedResult<UserResponseDto>>> GetAll([FromQuery] UserQueryParameters queryParams)
        {
            if (!string.IsNullOrWhiteSpace(queryParams.Role))
            {
                queryParams.Role = AppRoles.Normalize(queryParams.Role);
                if (queryParams.Role == null)
                    return BadRequest(new { message = "Vai trò không hợp lệ." });
            }
            if (!User.IsInRole(AppRoles.Admin) && queryParams.Role is not (null or AppRoles.User))
                return Forbid();
            // Never trust an incoming query parameter to determine directory scope.
            queryParams.AllowedRoles = User.IsInRole(AppRoles.Admin) ? null : [AppRoles.User];
            var result = await _userService.GetAllAsync(queryParams);
            return Ok(result);
        }

        // GET: api/users/1
        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetById(int id)
        {
            var user = await _context.Users
                .AsNoTracking()
                .Where(u => u.Id == id)
                .Select(u => new
                {
                    u.Id,
                    u.FullName,
                    u.Email,
                    u.Role,
                    u.CreatedAt
                })
                .FirstOrDefaultAsync();

            if (user == null)
                return NotFound(new
                {
                    message = "Không tìm thấy tài khoản"
                });

            if (!User.IsInRole(AppRoles.Admin) && user.Role != AppRoles.User)
                return Forbid();

            return Ok(user);
        }

        // POST: api/users
        [HttpPost]
        [Authorize(Roles = AppRoles.Admin)]
        public async Task<IActionResult> Create(
            [FromBody] CreateUserDto dto)
        {
            var role = AppRoles.Normalize(dto.Role);

            if (role == null)
                return BadRequest(new
                {
                    message = "Vai trò không hợp lệ"
                });

            var email = dto.Email.Trim().ToLowerInvariant();

            if (await _context.Users
                .AnyAsync(u => u.Email == email))
            {
                return Conflict(new
                {
                    message = "Email đã tồn tại"
                });
            }

            var user = new User
            {
                FullName = dto.FullName.Trim(),
                Email = email,
                Role = role,
                CreatedAt = DateTime.UtcNow
            };

            user.PasswordHash = _hasher.HashPassword(
                user, dto.Password);

            _context.Users.Add(user);

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException)
            {
                return Conflict(new
                {
                    message = "Không thể tạo tài khoản"
                });
            }

            return CreatedAtAction(
                nameof(GetById),
                new { id = user.Id },
                new
                {
                    user.Id,
                    user.FullName,
                    user.Email,
                    user.Role
                });
        }

        // PUT: api/users/1/role
        [HttpPut("{id:int}/role")]
        [Authorize(Roles = AppRoles.Admin)]
        public async Task<IActionResult> UpdateRole(
            int id,
            [FromBody] UpdateUserRoleDto dto)
        {
            var role = AppRoles.Normalize(dto.Role);

            if (role == null)
                return BadRequest(new
                {
                    message = "Vai trò không hợp lệ"
                });

            await using var transaction = await _context.Database.BeginTransactionAsync(IsolationLevel.Serializable);
            var user = await _context.Users.FindAsync(id);

            if (user == null)
                return NotFound(new
                {
                    message = "Tài khoản không tồn tại"
                });

            var currentUserId = User.FindFirstValue(
                ClaimTypes.NameIdentifier);

            if (currentUserId == id.ToString() &&
                role != "Admin")
            {
                return BadRequest(new
                {
                    message = "Không thể tự hạ quyền Admin"
                });
            }

            if (user.Role == "Admin" && role != "Admin")
            {
                var adminCount = await _context.Users
                    .CountAsync(u => u.Role == "Admin");

                if (adminCount <= 1)
                    return BadRequest(new
                    {
                        message = "Phải giữ ít nhất một Admin"
                    });
            }

            if (user.Role == AppRoles.Staff && role != AppRoles.Staff &&
                await _context.Courses.AnyAsync(course => course.StaffId == id))
                return Conflict(new { message = "Hãy phân công lại các khóa học trước khi đổi vai trò nhân viên." });

            if (user.Role == AppRoles.Instructor && role != AppRoles.Instructor &&
                await _context.Courses.AnyAsync(course => course.InstructorId == id))
                return Conflict(new { message = "Hãy phân công lại các khóa học trước khi đổi vai trò giảng viên." });

            if (user.Role != role) user.SecurityStamp = Guid.NewGuid().ToString("N");
            user.Role = role;
            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            return Ok(new
            {
                message = "Cập nhật vai trò thành công",
                user.Id,
                user.Role
            });
        }

        // PUT: api/users/5/reset-password
        [HttpPut("{id:int}/reset-password")]
        public async Task<IActionResult> ResetPassword(
            int id,
            [FromBody] ResetPasswordDto dto)
        {
            var user = await _context.Users.FindAsync(id);

            if (user == null)
            {
                return NotFound(new
                {
                    message = "Không tìm thấy tài khoản"
                });
            }

            if (!User.IsInRole(AppRoles.Admin) && user.Role != AppRoles.User)
            {
                return Forbid();
            }

            if (string.IsNullOrWhiteSpace(dto.NewPassword) ||
                dto.NewPassword.Length < 8)
            {
                return BadRequest(new
                {
                    message = "Mật khẩu phải có ít nhất 8 ký tự"
                });
            }

            user.PasswordHash = _hasher.HashPassword(
                user,
                dto.NewPassword
            );
            user.SecurityStamp = Guid.NewGuid().ToString("N");

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Đặt lại mật khẩu thành công. Các phiên đăng nhập cũ đã hết hiệu lực."
            });
        }
        // DELETE: api/users/1
        [HttpDelete("{id:int}")]
        [Authorize(Roles = AppRoles.Admin)]
        public async Task<IActionResult> Delete(int id)
        {
            await using var transaction = await _context.Database.BeginTransactionAsync(IsolationLevel.Serializable);
            var user = await _context.Users.FindAsync(id);

            if (user == null)
                return NotFound(new
                {
                    message = "Không tìm thấy tài khoản"
                });

            var currentUserId = User.FindFirstValue(
                ClaimTypes.NameIdentifier);

            if (currentUserId == id.ToString())
                return BadRequest(new
                {
                    message = "Không thể tự xóa tài khoản"
                });

            if (user.Role == "Admin")
            {
                var adminCount = await _context.Users
                    .CountAsync(u => u.Role == "Admin");

                if (adminCount <= 1)
                    return BadRequest(new
                    {
                        message = "Không thể xóa Admin cuối cùng"
                    });
            }

            _context.Users.Remove(user);

            try
            {
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();
            }
            catch (DbUpdateException)
            {
                return Conflict(new
                {
                    message = "Tài khoản đang có dữ liệu liên quan, không thể xóa"
                });
            }

            return Ok(new
            {
                message = "Xóa tài khoản thành công"
            });
        }
    }
}
