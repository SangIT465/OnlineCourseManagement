using Microsoft.AspNetCore.Identity;
using OnlineCourseManagement.DTOs;
using OnlineCourseManagement.DTOs.Common;
using OnlineCourseManagement.Models;
using OnlineCourseManagement.Repositories;

namespace OnlineCourseManagement.Services
{
    public class UserService : IUserService
    {
        private readonly IRepository<User> _userRepo;
        private readonly IPasswordHasher<User> _passwordHasher;

        public UserService(IRepository<User> userRepo, IPasswordHasher<User> passwordHasher)
        {
            _userRepo = userRepo;
            _passwordHasher = passwordHasher;
        }

        public async Task<UserResponseDto?> GetByIdAsync(int id)
        {
            var user = await _userRepo.GetByIdAsync(id);
            if (user == null)
                return null;

            return MapToResponseDto(user);
        }

        public async Task<List<UserResponseDto>> GetAllAsync()
        {
            var users = await _userRepo.GetAllAsync();
            return users.Select(MapToResponseDto).ToList();
        }

        public async Task<PagedResult<UserResponseDto>> GetAllAsync(UserQueryParameters queryParams)
        {
            var pagedUsers = await _userRepo.GetAllAsync(queryParams);

            // Map danh sách Entity sang DTO
            var mappedItems = pagedUsers.Items.Select(MapToResponseDto).ToList();

            // Trả về PagedResult chứa DTO
            return new PagedResult<UserResponseDto>(
                mappedItems,
                pagedUsers.TotalCount,
                pagedUsers.PageNumber,
                pagedUsers.PageSize
            );
        }

        public async Task<UserResponseDto> CreateAsync(CreateUserDto dto)
        {
            var user = new User
            {
                FullName = dto.FullName,
                Email = dto.Email.ToLower(),
                Role = dto.Role,
                CreatedAt = DateTime.UtcNow
            };

            user.PasswordHash = _passwordHasher.HashPassword(user, dto.Password);

            await _userRepo.AddAsync(user);
            await _userRepo.SaveChangesAsync();

            return MapToResponseDto(user);
        }

        public async Task<UserResponseDto> UpdateAsync(int id, UpdateUserDto dto)
        {
            var user = await _userRepo.GetByIdAsync(id);
            if (user == null)
                throw new KeyNotFoundException($"User với ID {id} không tồn tại");

            user.FullName = dto.FullName;
            user.Role = dto.Role;

            await _userRepo.UpdateAsync(user);
            await _userRepo.SaveChangesAsync();

            return MapToResponseDto(user);
        }

        public async Task DeleteAsync(int id)
        {
            var user = await _userRepo.GetByIdAsync(id);
            if (user == null)
                throw new KeyNotFoundException($"User với ID {id} không tồn tại");

            await _userRepo.DeleteAsync(user);
            await _userRepo.SaveChangesAsync();
        }

        public async Task ResetPasswordAsync(int id, string newPassword)
        {
            var user = await _userRepo.GetByIdAsync(id);
            if (user == null)
                throw new KeyNotFoundException($"User với ID {id} không tồn tại");

            user.PasswordHash = _passwordHasher.HashPassword(user, newPassword);

            await _userRepo.UpdateAsync(user);
            await _userRepo.SaveChangesAsync();
        }

        private UserResponseDto MapToResponseDto(User user)
        {
            return new UserResponseDto
            {
                Id = user.Id,
                FullName = user.FullName,
                Email = user.Email,
                Role = user.Role,
                CreatedAt = user.CreatedAt
            };
        }
    }
}
