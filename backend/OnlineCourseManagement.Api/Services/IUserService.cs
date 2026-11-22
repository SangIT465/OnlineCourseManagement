using OnlineCourseManagement.DTOs;
using OnlineCourseManagement.DTOs.Common;

namespace OnlineCourseManagement.Services
{
    public interface IUserService
    {
        Task<UserResponseDto?> GetByIdAsync(int id);
        Task<List<UserResponseDto>> GetAllAsync();
        Task<PagedResult<UserResponseDto>> GetAllAsync(UserQueryParameters queryParams);
        Task<UserResponseDto> CreateAsync(CreateUserDto dto);
        Task<UserResponseDto> UpdateAsync(int id, UpdateUserDto dto);
        Task DeleteAsync(int id);
        Task ResetPasswordAsync(int id, string newPassword);
    }
}
