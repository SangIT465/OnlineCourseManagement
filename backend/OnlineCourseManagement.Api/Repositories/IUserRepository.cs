using OnlineCourseManagement.DTOs.Common;
using OnlineCourseManagement.Models;

namespace OnlineCourseManagement.Repositories
{
    public interface IUserRepository
    {
        Task<User?> GetByIdAsync(int id, CancellationToken token);
        Task<PagedResult<User>> GetAllAsync(UserQueryParameters queryParams, CancellationToken token);
    }
}
