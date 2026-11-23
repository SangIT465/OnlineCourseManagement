using System.Data;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using OnlineCourseManagement.Data;
using OnlineCourseManagement.DTOs;
using OnlineCourseManagement.DTOs.Common;
using OnlineCourseManagement.Exceptions;
using OnlineCourseManagement.Models;
using OnlineCourseManagement.Security;

namespace OnlineCourseManagement.Services;

public sealed class CourseService(AppDbContext db, ICourseAccessService access, TimeProvider time) : ICourseService
{
    public Task<List<CourseResponseDto>> GetAllAsync(string? search, int? categoryId, CancellationToken token) =>
        Filter(search, categoryId).OrderByDescending(course => course.CreatedAt).ThenByDescending(course => course.Id)
            .Select(CatalogProjection.Course).ToListAsync(token);

    private IQueryable<Course> Filter(string? search, int? categoryId)
    {
        var query = db.Courses.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(search)) query = query.Where(course => course.Title.Contains(search.Trim()));
        if (categoryId.HasValue) query = query.Where(course => course.CategoryId == categoryId);
        return query;
    }

    public async Task<PagedResult<CourseResponseDto>> GetPageAsync(CourseQueryParameters input, CancellationToken token)
    {
        var query = Filter(input.Search, input.CategoryId);
        if (input.InstructorId.HasValue) query = query.Where(course => course.InstructorId == input.InstructorId);
        if (input.MinPrice.HasValue) query = query.Where(course => course.Price >= input.MinPrice);
        if (input.MaxPrice.HasValue) query = query.Where(course => course.Price <= input.MaxPrice);
        var count = await query.CountAsync(token);
        var sorted = input.SortBy.ToLowerInvariant() switch
        {
            "title" => input.IsDescending ? query.OrderByDescending(course => course.Title) : query.OrderBy(course => course.Title),
            "price" => input.IsDescending ? query.OrderByDescending(course => course.Price) : query.OrderBy(course => course.Price),
            _ => input.IsDescending ? query.OrderByDescending(course => course.CreatedAt) : query.OrderBy(course => course.CreatedAt)
        };
        var items = await sorted.ThenBy(course => course.Id).Skip(input.Skip).Take(input.PageSize)
            .Select(CatalogProjection.Course).ToListAsync(token);
        return new(items, count, input.PageNumber, input.PageSize);
    }

    public async Task<CourseResponseDto> GetByIdAsync(int id, CancellationToken token) =>
        await db.Courses.AsNoTracking().Where(course => course.Id == id).Select(CatalogProjection.Course).SingleOrDefaultAsync(token)
        ?? throw BusinessException.NotFound("Khóa học không tồn tại.");

    public Task<List<CourseResponseDto>> GetMineAsync(ClaimsPrincipal actor, CancellationToken token)
    {
        var id = actor.RequireUserId();
        var teacher = actor.IsInRole(AppRoles.Instructor);
        return db.Courses.AsNoTracking().Where(course => teacher ? course.InstructorId == id : course.StaffId == id)
            .OrderByDescending(course => course.CreatedAt).ThenByDescending(course => course.Id)
            .Select(CatalogProjection.Course).ToListAsync(token);
    }

    public async Task<CourseResponseDto> CreateAsync(CreateCourseDto input, ClaimsPrincipal actor, CancellationToken token)
    {
        var userId = actor.RequireUserId();
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, token);
        var account = await db.FindForUpdateAsync(userId, token);
        if (account is null || account.Role != actor.FindFirstValue(ClaimTypes.Role) ||
            account.SecurityStamp != actor.FindFirstValue(AppRoles.SecurityStampClaim))
            throw BusinessException.Unauthenticated();
        var course = new Course
        {
            Title = input.Title.Trim(), Description = input.Description?.Trim(), Price = input.Price,
            CategoryId = input.CategoryId, CreatedAt = time.GetUtcNow().UtcDateTime,
            InstructorId = actor.IsInRole(AppRoles.Instructor) ? userId : null,
            StaffId = actor.IsInRole(AppRoles.Staff) ? userId : null
        };
        await access.EnsureCanManageAsync(actor, course);
        await EnsureCategoryAsync(input.CategoryId, token);
        db.Courses.Add(course);
        await db.SaveChangesAsync(token);
        await transaction.CommitAsync(token);
        return await GetByIdAsync(course.Id, token);
    }

    public async Task UpdateAsync(int id, UpdateCourseDto input, ClaimsPrincipal actor, CancellationToken token)
    {
        var course = await FindAsync(id, token);
        await access.EnsureCanManageAsync(actor, course);
        await EnsureCategoryAsync(input.CategoryId, token);
        course.Title = input.Title.Trim();
        course.Description = input.Description?.Trim();
        course.Price = input.Price;
        course.CategoryId = input.CategoryId;
        await db.SaveChangesAsync(token);
    }

    public async Task<CourseResponseDto> AssignAsync(int id, int? operatorId, string role, ClaimsPrincipal actor, CancellationToken token)
    {
        if (!actor.IsInRole(AppRoles.Admin) || !actor.HasClaim(AppPermissions.ClaimType, AppPermissions.AccountsManage))
            throw BusinessException.Forbidden();
        // Keep the target role stable until the course assignment is committed.
        // UpdateRole uses the same isolation level to prevent conflicting role changes.
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, token);
        if (role is not (AppRoles.Staff or AppRoles.Instructor))
            throw BusinessException.Invalid("Tài khoản được phân công không tồn tại hoặc không đúng vai trò.");
        if (operatorId.HasValue)
        {
            var assignee = await db.FindForUpdateAsync(operatorId.Value, token);
            if (assignee is null || assignee.Role != role)
                throw BusinessException.Invalid("Tài khoản được phân công không tồn tại hoặc không đúng vai trò.");
        }
        var course = await FindAsync(id, token);
        if (role == AppRoles.Staff) course.StaffId = operatorId;
        else course.InstructorId = operatorId;
        await db.SaveChangesAsync(token);
        await transaction.CommitAsync(token);
        return await GetByIdAsync(id, token);
    }

    public async Task DeleteAsync(int id, ClaimsPrincipal actor, CancellationToken token)
    {
        var course = await FindAsync(id, token);
        await access.EnsureCanManageAsync(actor, course);
        if (await db.Lessons.AnyAsync(lesson => lesson.CourseId == id, token))
            throw BusinessException.Conflict("Hãy xử lý các bài học trước khi xóa khóa học.");
        if (await db.Enrollments.AnyAsync(enrollment => enrollment.CourseId == id, token) ||
            await db.UploadedFiles.AnyAsync(file => file.CourseId == id, token))
            throw BusinessException.Conflict("Khóa học đang có ghi danh hoặc học liệu liên quan.");
        db.Courses.Remove(course);
        await db.SaveChangesAsync(token);
    }

    private async Task<Course> FindAsync(int id, CancellationToken token) =>
        await db.Courses.SingleOrDefaultAsync(course => course.Id == id, token)
        ?? throw BusinessException.NotFound("Khóa học không tồn tại.");

    private async Task EnsureCategoryAsync(int id, CancellationToken token)
    {
        if (!await db.Categories.AnyAsync(category => category.Id == id, token))
            throw BusinessException.Invalid("Danh mục không tồn tại.");
    }
}
