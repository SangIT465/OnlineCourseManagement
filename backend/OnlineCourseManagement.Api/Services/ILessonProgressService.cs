using System.Security.Claims;
using OnlineCourseManagement.DTOs;

namespace OnlineCourseManagement.Services;

public interface ILessonProgressService
{
    Task<LessonCompletionDto> CompleteAsync(int lessonId, ClaimsPrincipal actor, CancellationToken token);
    Task<LessonCompletionDto> UndoCompleteAsync(int lessonId, ClaimsPrincipal actor, CancellationToken token);
    Task<CourseProgressDto?> GetCourseAsync(int courseId, ClaimsPrincipal actor, CancellationToken token);
    Task<List<CourseProgressSummaryDto>> GetMineAsync(ClaimsPrincipal actor, CancellationToken token);
    Task<CourseStudentsProgressDto?> GetStudentsAsync(int courseId, ClaimsPrincipal actor, CancellationToken token);
}
