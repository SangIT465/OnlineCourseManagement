using Microsoft.EntityFrameworkCore;
using OnlineCourseManagement.Data;
using OnlineCourseManagement.DTOs.Common;
using OnlineCourseManagement.Models;

namespace OnlineCourseManagement.Repositories
{
    public class UserRepository : IUserRepository
    {
        private readonly AppDbContext _db;

        public UserRepository(AppDbContext db)
        {
            _db = db;
        }

        public Task<User?> GetByIdAsync(int id, CancellationToken token)
        {
            return _db.Users.AsNoTracking().SingleOrDefaultAsync(user => user.Id == id, token);
        }

        public async Task<PagedResult<User>> GetAllAsync(UserQueryParameters queryParams, CancellationToken token)
        {
            var query = _db.Users.AsNoTracking().AsQueryable();

            if (queryParams.AllowedRoles is { Length: > 0 })
                query = query.Where(user => queryParams.AllowedRoles.Contains(user.Role));

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
            var sorted = queryParams.SortBy?.ToLower() switch
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
            var totalCount = await query.CountAsync(token);

            // 5. PAGINATION (Chỉ lấy đúng PageSize dòng từ DB)
            var items = await sorted
                .ThenBy(u => u.Id)
                .Skip(queryParams.Skip)
                .Take(queryParams.PageSize)
                .Select(u => new User { Id = u.Id, FullName = u.FullName, Email = u.Email, Role = u.Role, CreatedAt = u.CreatedAt })
                .ToListAsync(token);

            return new PagedResult<User>(items, totalCount, queryParams.PageNumber, queryParams.PageSize);
        }
    }
}
