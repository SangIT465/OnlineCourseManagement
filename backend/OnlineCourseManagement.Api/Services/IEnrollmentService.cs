using System.Security.Claims;
using OnlineCourseManagement.DTOs;

namespace OnlineCourseManagement.Services;

public interface IEnrollmentService
{
    Task<EnrollmentResponseDto> EnrollAsync(EnrollCourseDto input, ClaimsPrincipal actor, CancellationToken token);
    Task<List<MyEnrollmentDto>> GetMineAsync(ClaimsPrincipal actor, CancellationToken token);
    Task<List<EnrollmentSummaryDto>> GetAllAsync(CancellationToken token);
    Task<CourseStudentsDto> GetStudentsAsync(int courseId, ClaimsPrincipal actor, CancellationToken token);
    Task CancelAsync(int courseId, ClaimsPrincipal actor, CancellationToken token);
}
