using System.Security.Claims;
using OnlineCourseManagement.DTOs;
using OnlineCourseManagement.DTOs.Common;

namespace OnlineCourseManagement.Services;

public interface ICourseService
{
    Task<List<CourseResponseDto>> GetAllAsync(string? search, int? categoryId, CancellationToken token);
    Task<PagedResult<CourseResponseDto>> GetPageAsync(CourseQueryParameters query, CancellationToken token);
    Task<CourseResponseDto> GetByIdAsync(int id, CancellationToken token);
    Task<List<CourseResponseDto>> GetMineAsync(ClaimsPrincipal actor, CancellationToken token);
    Task<CourseResponseDto> CreateAsync(CreateCourseDto input, ClaimsPrincipal actor, CancellationToken token);
    Task UpdateAsync(int id, UpdateCourseDto input, ClaimsPrincipal actor, CancellationToken token);
    Task<CourseResponseDto> AssignAsync(int id, int? operatorId, string role, ClaimsPrincipal actor, CancellationToken token);
    Task DeleteAsync(int id, ClaimsPrincipal actor, CancellationToken token);
}
