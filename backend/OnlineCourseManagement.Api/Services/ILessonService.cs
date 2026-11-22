using System.Security.Claims;
using OnlineCourseManagement.DTOs;
using OnlineCourseManagement.DTOs.Common;

namespace OnlineCourseManagement.Services;

public interface ILessonService
{
    Task<List<LessonSummaryDto>> GetAllAsync(CancellationToken token);
    Task<List<LessonSummaryDto>> GetByCourseAsync(int courseId, CancellationToken token);
    Task<PagedResult<LessonSummaryDto>> GetPageAsync(LessonQueryParameters query, CancellationToken token);
    Task<LessonResponseDto> GetByIdAsync(int id, ClaimsPrincipal actor, CancellationToken token);
    Task<LessonResponseDto> CreateAsync(CreateLessonDto input, ClaimsPrincipal actor, CancellationToken token);
    Task UpdateAsync(int id, UpdateLessonDto input, ClaimsPrincipal actor, CancellationToken token);
    Task DeleteAsync(int id, ClaimsPrincipal actor, CancellationToken token);
}
