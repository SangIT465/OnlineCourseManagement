using OnlineCourseManagement.DTOs;

namespace OnlineCourseManagement.Services;

public interface ICategoryService
{
    Task<List<CategoryResponseDto>> GetAllAsync(CancellationToken token);
    Task<CategoryResponseDto> GetByIdAsync(int id, CancellationToken token);
    Task<CategoryResponseDto> CreateAsync(CategoryInputDto input, CancellationToken token);
    Task UpdateAsync(int id, CategoryInputDto input, CancellationToken token);
    Task DeleteAsync(int id, CancellationToken token);
}
