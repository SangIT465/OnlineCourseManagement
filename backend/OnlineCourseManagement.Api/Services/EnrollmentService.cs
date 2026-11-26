using System.Data;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using OnlineCourseManagement.Data;
using OnlineCourseManagement.DTOs;
using OnlineCourseManagement.Exceptions;
using OnlineCourseManagement.Models;
using OnlineCourseManagement.Security;

namespace OnlineCourseManagement.Services;

public sealed class EnrollmentService(AppDbContext db, ICourseAccessService access, TimeProvider time) : IEnrollmentService
{
    public Task<EnrollmentResponseDto> EnrollAsync(
        EnrollCourseDto input, ClaimsPrincipal actor, CancellationToken token) =>
        EnrollStudentAsync(actor.RequireUserId(), input.CourseId, token);

    public Task<EnrollmentResponseDto> SupportEnrollAsync(
        SupportEnrollmentDto input, ClaimsPrincipal actor, CancellationToken token)
    {
        if (!actor.IsInRole(AppRoles.Admin) && !actor.IsInRole(AppRoles.Staff))
            throw BusinessException.Forbidden();
        return EnrollStudentAsync(input.StudentId, input.CourseId, token);
    }

    private async Task<EnrollmentResponseDto> EnrollStudentAsync(int studentId, int courseId, CancellationToken token)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, token);
        await db.FindForUpdateAsync(studentId, token);

        if (!await db.Users.AnyAsync(user => user.Id == studentId && user.Role == AppRoles.User, token))
            throw BusinessException.Forbidden();
        var course = await db.Courses.AsNoTracking().SingleOrDefaultAsync(course => course.Id == courseId, token)
            ?? throw BusinessException.NotFound("Khóa học không tồn tại");
        if (await db.Enrollments.AnyAsync(enrollment => enrollment.StudentId == studentId &&
            enrollment.CourseId == courseId, token))
            throw BusinessException.Conflict("Bạn đã đăng ký khóa học này");
        if (course.Price > 0 && !await db.CoursePurchases.AnyAsync(purchase => purchase.StudentId == studentId &&
            purchase.CourseId == courseId && purchase.Status == PurchaseStatus.Paid, token))
            throw BusinessException.Conflict("Khóa học có học phí cần được thanh toán qua payOS trước khi ghi danh.");

        var enrollment = new Enrollment
        {
            StudentId = studentId, CourseId = courseId, EnrolledAt = time.GetUtcNow().UtcDateTime
        };
        db.Enrollments.Add(enrollment);
        try
        {
            await db.SaveChangesAsync(token);
            await transaction.CommitAsync(token);
        }
        catch (DbUpdateException)
        {
            throw BusinessException.Conflict("Không thể đăng ký. Hãy kiểm tra trạng thái khóa học và thử lại.");
        }
        return new(enrollment.Id, enrollment.StudentId, enrollment.CourseId, enrollment.EnrolledAt);
    }

    public Task<List<EnrollmentReportRow>> GetReportAsync(EnrollmentReportQuery input, CancellationToken token)
    {
        var query = db.Enrollments.AsNoTracking();
        if (input.CourseId is int courseId) query = query.Where(e => e.CourseId == courseId);
        if (!string.IsNullOrWhiteSpace(input.Search))
        {
            var search = input.Search.Trim();
            query = query.Where(e => e.Student.FullName.Contains(search) ||
                e.Student.Email.Contains(search) || e.Course.Title.Contains(search));
        }
        return query.OrderBy(e => e.CourseId).ThenBy(e => e.StudentId)
            .Select(e => new EnrollmentReportRow(e.StudentId, e.Student.FullName, e.Student.Email,
                e.CourseId, e.Course.Title, e.EnrolledAt,
                db.Lessons.Count(l => l.CourseId == e.CourseId),
                db.LessonProgresses.Count(p => p.EnrollmentId == e.Id && p.IsCompleted && p.Lesson.CourseId == e.CourseId)))
            .ToListAsync(token);
    }

    public Task<List<MyEnrollmentDto>> GetMineAsync(ClaimsPrincipal actor, CancellationToken token)
    {
        var studentId = actor.RequireUserId();
        return db.Enrollments.AsNoTracking().Where(enrollment => enrollment.StudentId == studentId)
            .OrderByDescending(enrollment => enrollment.EnrolledAt)
            .Select(enrollment => new MyEnrollmentDto(enrollment.Id, enrollment.CourseId, enrollment.Course.Title,
                enrollment.Course.Description, enrollment.Course.Price, enrollment.EnrolledAt)).ToListAsync(token);
    }

    public Task<List<EnrollmentSummaryDto>> GetAllAsync(CancellationToken token) =>
        db.Enrollments.AsNoTracking().OrderByDescending(enrollment => enrollment.EnrolledAt)
            .Select(enrollment => new EnrollmentSummaryDto(enrollment.Id, enrollment.StudentId,
                enrollment.Student.FullName, enrollment.Student.Email, enrollment.CourseId,
                enrollment.Course.Title, enrollment.EnrolledAt)).ToListAsync(token);

    public async Task<CourseStudentsDto> GetStudentsAsync(int courseId, ClaimsPrincipal actor, CancellationToken token)
    {
        var course = await db.Courses.AsNoTracking().SingleOrDefaultAsync(course => course.Id == courseId, token)
            ?? throw BusinessException.NotFound("Khóa học không tồn tại");
        await access.EnsureCanManageAsync(actor, course);
        var students = await db.Enrollments.AsNoTracking().Where(enrollment => enrollment.CourseId == courseId)
            .OrderBy(enrollment => enrollment.Student.FullName)
            .Select(enrollment => new EnrolledStudentDto(enrollment.Id, enrollment.StudentId,
                enrollment.Student.FullName, enrollment.Student.Email, enrollment.EnrolledAt)).ToListAsync(token);
        return new(course.Id, course.Title, students.Count, students);
    }

    public async Task CancelAsync(int courseId, ClaimsPrincipal actor, CancellationToken token)
    {
        var studentId = actor.RequireUserId();
        var enrollment = await db.Enrollments.SingleOrDefaultAsync(enrollment =>
            enrollment.StudentId == studentId && enrollment.CourseId == courseId, token)
            ?? throw BusinessException.NotFound("Bạn chưa đăng ký khóa học này");
        db.Enrollments.Remove(enrollment);
        await db.SaveChangesAsync(token);
    }
}
