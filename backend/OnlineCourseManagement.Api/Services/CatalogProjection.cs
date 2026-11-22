using System.Linq.Expressions;
using OnlineCourseManagement.DTOs;
using OnlineCourseManagement.Models;

namespace OnlineCourseManagement.Services;

internal static class CatalogProjection
{
    public static readonly Expression<Func<Course, CourseResponseDto>> Course = course => new(
        course.Id, course.Title, course.Description, course.Price, course.CategoryId,
        course.Category != null ? course.Category.Name : null, course.InstructorId, course.StaffId,
        course.Staff != null ? course.Staff.FullName : null,
        course.Instructor != null ? course.Instructor.FullName : null, course.CreatedAt);
    public static readonly Expression<Func<Lesson, LessonSummaryDto>> Lesson = lesson => new(
        lesson.Id, lesson.Title, lesson.DurationMinutes, lesson.OrderIndex, lesson.CourseId);
}
