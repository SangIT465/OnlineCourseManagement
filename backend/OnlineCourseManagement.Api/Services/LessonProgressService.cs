using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using OnlineCourseManagement.Data;
using OnlineCourseManagement.DTOs;
using OnlineCourseManagement.Exceptions;
using OnlineCourseManagement.Models;

namespace OnlineCourseManagement.Services;

public sealed class LessonProgressService(AppDbContext db, ICourseAccessService access, TimeProvider time) : ILessonProgressService
{
    public async Task<LessonCompletionDto> CompleteAsync(int lessonId, ClaimsPrincipal actor, CancellationToken token)
    {
        var studentId = actor.RequireUserId();
        var lesson = await db.Lessons.AsNoTracking().SingleOrDefaultAsync(lesson => lesson.Id == lessonId, token)
            ?? throw BusinessException.NotFound("Bài học không tồn tại");
        var enrollment = await db.Enrollments.SingleOrDefaultAsync(enrollment =>
            enrollment.StudentId == studentId && enrollment.CourseId == lesson.CourseId, token)
            ?? throw BusinessException.Forbidden();
        var progress = await db.LessonProgresses.SingleOrDefaultAsync(progress =>
            progress.EnrollmentId == enrollment.Id && progress.LessonId == lessonId, token);

        if (progress is null)
        {
            progress = new LessonProgress
            {
                EnrollmentId = enrollment.Id, LessonId = lessonId,
                IsCompleted = true, CompletedAt = time.GetUtcNow().UtcDateTime
            };
            db.LessonProgresses.Add(progress);
        }
        else if (!progress.IsCompleted)
        {
            progress.IsCompleted = true;
            progress.CompletedAt = time.GetUtcNow().UtcDateTime;
        }

        // Repeating completion keeps the original completion time.
        try { await db.SaveChangesAsync(token); }
        catch (DbUpdateException) { throw BusinessException.Conflict("Không thể cập nhật tiến độ. Hãy tải lại."); }
        return new(progress.LessonId, progress.IsCompleted, progress.CompletedAt);
    }

    public async Task<LessonCompletionDto> UndoCompleteAsync(int lessonId, ClaimsPrincipal actor, CancellationToken token)
    {
        var studentId = actor.RequireUserId();
        var progress = await db.LessonProgresses.Include(progress => progress.Enrollment)
            .SingleOrDefaultAsync(progress => progress.LessonId == lessonId &&
                progress.Enrollment.StudentId == studentId && progress.Enrollment.CourseId == progress.Lesson.CourseId, token)
            ?? throw BusinessException.NotFound("Chưa có tiến độ cho bài học này");
        progress.IsCompleted = false;
        progress.CompletedAt = null;
        await db.SaveChangesAsync(token);
        return new(progress.LessonId, progress.IsCompleted, progress.CompletedAt);
    }

    public async Task<CourseProgressDto?> GetCourseAsync(int courseId, ClaimsPrincipal actor, CancellationToken token)
    {
        var studentId = actor.RequireUserId();
        var enrollment = await db.Enrollments.AsNoTracking().SingleOrDefaultAsync(enrollment =>
            enrollment.StudentId == studentId && enrollment.CourseId == courseId, token)
            ?? throw BusinessException.Forbidden();
        var course = await db.Courses.AsNoTracking().SingleOrDefaultAsync(course => course.Id == courseId, token);
        if (course is null) return null;

        var lessons = await db.Lessons.AsNoTracking().Where(lesson => lesson.CourseId == courseId)
            .OrderBy(lesson => lesson.OrderIndex).Select(lesson => new { lesson.Id, lesson.Title, lesson.OrderIndex })
            .ToListAsync(token);
        var completed = await db.LessonProgresses.AsNoTracking().Where(progress =>
            progress.EnrollmentId == enrollment.Id && progress.IsCompleted && progress.Lesson.CourseId == courseId)
            .Select(progress => progress.LessonId).ToListAsync(token);
        var completedIds = completed.ToHashSet();
        var completedCount = lessons.Count(lesson => completedIds.Contains(lesson.Id));
        var items = lessons.Select(lesson => new LessonProgressDto(lesson.Id, lesson.Title,
            lesson.OrderIndex, completedIds.Contains(lesson.Id))).ToList();
        return new(course.Id, course.Title, lessons.Count, completedCount,
            Percentage(completedCount, lessons.Count), items);
    }

    public async Task<List<CourseProgressSummaryDto>> GetMineAsync(ClaimsPrincipal actor, CancellationToken token)
    {
        var studentId = actor.RequireUserId();
        var data = await db.Enrollments.AsNoTracking().Where(enrollment => enrollment.StudentId == studentId)
            .Select(enrollment => new
            {
                enrollment.CourseId, CourseName = enrollment.Course.Title,
                TotalLessons = db.Lessons.Count(lesson => lesson.CourseId == enrollment.CourseId),
                CompletedLessons = db.LessonProgresses.Count(progress => progress.EnrollmentId == enrollment.Id &&
                    progress.IsCompleted && progress.Lesson.CourseId == enrollment.CourseId)
            }).ToListAsync(token);
        return data.Select(course => new CourseProgressSummaryDto(course.CourseId, course.CourseName,
            course.TotalLessons, course.CompletedLessons, Percentage(course.CompletedLessons, course.TotalLessons))).ToList();
    }

    public async Task<CourseStudentsProgressDto?> GetStudentsAsync(
        int courseId, ClaimsPrincipal actor, CancellationToken token)
    {
        var course = await db.Courses.AsNoTracking().SingleOrDefaultAsync(course => course.Id == courseId, token);
        if (course is null) return null;
        await access.EnsureCanManageAsync(actor, course);
        var totalLessons = await db.Lessons.CountAsync(lesson => lesson.CourseId == courseId, token);
        var data = await db.Enrollments.AsNoTracking().Where(enrollment => enrollment.CourseId == courseId)
            .Select(enrollment => new
            {
                enrollment.StudentId, StudentName = enrollment.Student.FullName,
                StudentEmail = enrollment.Student.Email, enrollment.EnrolledAt,
                CompletedLessons = db.LessonProgresses.Count(progress => progress.EnrollmentId == enrollment.Id &&
                    progress.IsCompleted && progress.Lesson.CourseId == courseId)
            }).ToListAsync(token);
        var students = data.Select(student => new StudentProgressDto(student.StudentId, student.StudentName,
            student.StudentEmail, student.EnrolledAt, totalLessons, student.CompletedLessons,
            Percentage(student.CompletedLessons, totalLessons))).ToList();
        return new(courseId, course.Title, data.Count, students);
    }

    private static double Percentage(int completed, int total) =>
        total == 0 ? 0 : Math.Round(completed * 100.0 / total, 2);
}
