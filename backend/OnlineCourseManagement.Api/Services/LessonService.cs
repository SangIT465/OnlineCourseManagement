using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using OnlineCourseManagement.Data;
using OnlineCourseManagement.DTOs;
using OnlineCourseManagement.DTOs.Common;
using OnlineCourseManagement.Exceptions;
using OnlineCourseManagement.Models;
using OnlineCourseManagement.Security;

namespace OnlineCourseManagement.Services;

public sealed class LessonService(AppDbContext db, ICourseAccessService access, TimeProvider time) : ILessonService
{
    public Task<List<LessonSummaryDto>> GetAllAsync(CancellationToken token) =>
        db.Lessons.AsNoTracking().OrderBy(lesson => lesson.CourseId).ThenBy(lesson => lesson.OrderIndex)
            .ThenBy(lesson => lesson.Id).Select(CatalogProjection.Lesson).ToListAsync(token);

    public async Task<List<LessonSummaryDto>> GetByCourseAsync(int courseId, CancellationToken token)
    {
        await FindCourseAsync(courseId, token);
        return await db.Lessons.AsNoTracking().Where(lesson => lesson.CourseId == courseId)
            .OrderBy(lesson => lesson.OrderIndex).ThenBy(lesson => lesson.Id)
            .Select(CatalogProjection.Lesson).ToListAsync(token);
    }

    public async Task<PagedResult<LessonSummaryDto>> GetPageAsync(LessonQueryParameters input, CancellationToken token)
    {
        var query = db.Lessons.AsNoTracking();
        if (input.CourseId.HasValue) query = query.Where(lesson => lesson.CourseId == input.CourseId);
        if (!string.IsNullOrWhiteSpace(input.Search)) query = query.Where(lesson => lesson.Title.Contains(input.Search.Trim()));
        var count = await query.CountAsync(token);
        var sorted = input.SortBy.ToLowerInvariant() switch
        {
            "title" => input.IsDescending ? query.OrderByDescending(lesson => lesson.Title) : query.OrderBy(lesson => lesson.Title),
            "duration" => input.IsDescending ? query.OrderByDescending(lesson => lesson.DurationMinutes) : query.OrderBy(lesson => lesson.DurationMinutes),
            _ => input.IsDescending ? query.OrderByDescending(lesson => lesson.CourseId).ThenByDescending(lesson => lesson.OrderIndex)
                : query.OrderBy(lesson => lesson.CourseId).ThenBy(lesson => lesson.OrderIndex)
        };
        var items = await sorted.ThenBy(lesson => lesson.Id).Skip(input.Skip).Take(input.PageSize)
            .Select(CatalogProjection.Lesson).ToListAsync(token);
        return new(items, count, input.PageNumber, input.PageSize);
    }

    public async Task<LessonResponseDto> GetByIdAsync(int id, ClaimsPrincipal actor, CancellationToken token)
    {
        var lesson = await FindAsync(id, token);
        var course = lesson.Course ?? throw BusinessException.NotFound("Khóa học không tồn tại.");
        var permitted = await access.CanManageAsync(actor, course);
        if (!permitted && actor.IsInRole(AppRoles.User))
        {
            var userId = actor.RequireUserId();
            permitted = await db.Enrollments.AnyAsync(enrollment => enrollment.CourseId == course.Id && enrollment.StudentId == userId, token);
        }
        if (!permitted) throw BusinessException.Forbidden();
        return Map(lesson);
    }

    public async Task<LessonResponseDto> CreateAsync(CreateLessonDto input, ClaimsPrincipal actor, CancellationToken token)
    {
        var course = await FindCourseAsync(input.CourseId, token, invalidInput: true);
        await access.EnsureCanManageAsync(actor, course);
        await EnsureOrderAsync(input.CourseId, input.OrderIndex, null, token);
        var lesson = new Lesson
        {
            CourseId = input.CourseId, Title = input.Title.Trim(), Content = input.Content,
            VideoUrl = string.IsNullOrWhiteSpace(input.VideoUrl) ? null : input.VideoUrl.Trim(),
            DurationMinutes = input.DurationMinutes, OrderIndex = input.OrderIndex, CreatedAt = time.GetUtcNow().UtcDateTime
        };
        db.Lessons.Add(lesson);
        await db.SaveChangesAsync(token);
        return Map(lesson);
    }

    public async Task UpdateAsync(int id, UpdateLessonDto input, ClaimsPrincipal actor, CancellationToken token)
    {
        var lesson = await FindAsync(id, token);
        await access.EnsureCanManageAsync(actor, lesson.Course!);
        var destination = await FindCourseAsync(input.CourseId, token, invalidInput: true);
        await access.EnsureCanManageAsync(actor, destination);
        if (lesson.CourseId != input.CourseId &&
            (await db.LessonProgresses.AnyAsync(progress => progress.LessonId == id, token) ||
             await db.UploadedFiles.AnyAsync(file => file.LessonId == id, token)))
            throw BusinessException.Conflict("Không thể chuyển bài học đang có tiến độ hoặc học liệu sang khóa khác.");
        await EnsureOrderAsync(input.CourseId, input.OrderIndex, id, token);
        lesson.Title = input.Title.Trim();
        lesson.Content = input.Content;
        lesson.VideoUrl = string.IsNullOrWhiteSpace(input.VideoUrl) ? null : input.VideoUrl.Trim();
        lesson.DurationMinutes = input.DurationMinutes;
        lesson.OrderIndex = input.OrderIndex;
        lesson.CourseId = input.CourseId;
        await db.SaveChangesAsync(token);
    }

    public async Task DeleteAsync(int id, ClaimsPrincipal actor, CancellationToken token)
    {
        var lesson = await FindAsync(id, token);
        await access.EnsureCanManageAsync(actor, lesson.Course!);
        if (await db.UploadedFiles.AnyAsync(file => file.LessonId == id, token))
            throw BusinessException.Conflict("Hãy xóa học liệu của bài học trước khi xóa bài học.");
        // Both progress rows and the lesson are removed in SaveChanges' transaction.
        db.LessonProgresses.RemoveRange(await db.LessonProgresses.Where(progress => progress.LessonId == id).ToListAsync(token));
        db.Lessons.Remove(lesson);
        await db.SaveChangesAsync(token);
    }

    private async Task<Lesson> FindAsync(int id, CancellationToken token) =>
        await db.Lessons.Include(lesson => lesson.Course).SingleOrDefaultAsync(lesson => lesson.Id == id, token)
        ?? throw BusinessException.NotFound("Bài học không tồn tại.");

    private async Task<Course> FindCourseAsync(int id, CancellationToken token, bool invalidInput = false) =>
        await db.Courses.SingleOrDefaultAsync(course => course.Id == id, token)
        ?? throw (invalidInput ? BusinessException.Invalid("Khóa học không tồn tại.") : BusinessException.NotFound("Khóa học không tồn tại."));

    private async Task EnsureOrderAsync(int courseId, int order, int? exceptId, CancellationToken token)
    {
        if (await db.Lessons.AnyAsync(lesson => lesson.CourseId == courseId && lesson.OrderIndex == order && lesson.Id != exceptId, token))
            throw BusinessException.Conflict("Thứ tự bài học đã tồn tại trong khóa học.");
    }

    private static LessonResponseDto Map(Lesson lesson) => new(lesson.Id, lesson.Title, lesson.Content,
        lesson.VideoUrl, lesson.DurationMinutes, lesson.OrderIndex, lesson.CourseId, lesson.CreatedAt);
}
