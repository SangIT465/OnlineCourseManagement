using OnlineCourseManagement.DTOs.Common;

namespace OnlineCourseManagement.Repositories
{
    public interface IRepository<T> where T : class
    {
        Task<T?> GetByIdAsync(int id);
        Task<List<T>> GetAllAsync();
        Task<PagedResult<T>> GetAllAsync(UserQueryParameters queryParams);
        Task AddAsync(T entity);
        Task UpdateAsync(T entity);
        Task DeleteAsync(T entity);
        Task SaveChangesAsync();
    }
}
