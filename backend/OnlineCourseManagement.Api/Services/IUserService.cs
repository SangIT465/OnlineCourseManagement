using System.Security.Claims;
using OnlineCourseManagement.DTOs;
using OnlineCourseManagement.DTOs.Common;

namespace OnlineCourseManagement.Services;

public interface IUserService
{
    Task<PagedResult<UserResponseDto>> GetAllAsync(UserQueryParameters input, ClaimsPrincipal actor, CancellationToken token);
    Task<UserResponseDto> GetByIdAsync(int id, ClaimsPrincipal actor, CancellationToken token);
    Task<UserResponseDto> CreateAsync(CreateUserDto input, CancellationToken token);
    Task<UserResponseDto> UpdateRoleAsync(int id, UpdateUserRoleDto input, ClaimsPrincipal actor, CancellationToken token);
    Task ResetPasswordAsync(int id, string password, ClaimsPrincipal actor, CancellationToken token);
    Task DeleteAsync(int id, ClaimsPrincipal actor, CancellationToken token);
}
