using Microsoft.EntityFrameworkCore;
using OnlineCourseManagement.Data;
using OnlineCourseManagement.DTOs.Common;
using OnlineCourseManagement.Models;

namespace OnlineCourseManagement.Repositories
{
    public class UserRepository : IRepository<User>
    {
        private readonly AppDbContext _db;

        public UserRepository(AppDbContext db)
        {
            _db = db;
        }

        public async Task<User?> GetByIdAsync(int id)
        {
            return await _db.Users.FindAsync(id);
        }

        public async Task<List<User>> GetAllAsync()
        {
            return await _db.Users.AsNoTracking().ToListAsync();
        }

        public async Task<PagedResult<User>> GetAllAsync(UserQueryParameters queryParams)
        {
            var query = _db.Users.AsNoTracking().AsQueryable();

            // 1. SEARCH (Tìm kiếm tương đối)
            if (!string.IsNullOrWhiteSpace(queryParams.SearchTerm))
            {
                var term = queryParams.SearchTerm.Trim().ToLower();
                query = query.Where(u => u.Email.ToLower().Contains(term)
                                      || u.FullName.ToLower().Contains(term));
            }

            // 2. FILTER (Lọc chính xác)
            if (!string.IsNullOrWhiteSpace(queryParams.Role))
            {
                query = query.Where(u => u.Role == queryParams.Role);
            }

            // 3. SORTING
            query = queryParams.SortBy?.ToLower() switch
            {
                "email" => queryParams.IsDescending
                    ? query.OrderByDescending(u => u.Email)
                    : query.OrderBy(u => u.Email),

                "createdat" => queryParams.IsDescending
                    ? query.OrderByDescending(u => u.CreatedAt)
                    : query.OrderBy(u => u.CreatedAt),

                _ => queryParams.IsDescending
                    ? query.OrderByDescending(u => u.FullName)
                    : query.OrderBy(u => u.FullName) // Mặc định sort theo FullName
            };

            // 4. COUNT (Tổng số dòng thỏa điều kiện search/filter)
            var totalCount = await query.CountAsync();

            // 5. PAGINATION (Chỉ lấy đúng PageSize dòng từ DB)
            var items = await query
                .Skip((queryParams.PageNumber - 1) * queryParams.PageSize)
                .Take(queryParams.PageSize)
                .ToListAsync();

            return new PagedResult<User>(items, totalCount, queryParams.PageNumber, queryParams.PageSize);
        }

        public async Task AddAsync(User entity)
        {
            await _db.Users.AddAsync(entity);
        }

        public async Task UpdateAsync(User entity)
        {
            _db.Users.Update(entity);
            await Task.CompletedTask;
        }

        public async Task DeleteAsync(User entity)
        {
            _db.Users.Remove(entity);
            await Task.CompletedTask;
        }

        public async Task SaveChangesAsync()
        {
            await _db.SaveChangesAsync();
        }
    }
}
