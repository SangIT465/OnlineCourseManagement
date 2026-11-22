using Microsoft.EntityFrameworkCore;
using OnlineCourseManagement.Data;
using OnlineCourseManagement.DTOs;
using OnlineCourseManagement.Exceptions;
using OnlineCourseManagement.Models;

namespace OnlineCourseManagement.Services;

public sealed class CategoryService(AppDbContext db) : ICategoryService
{
    public Task<List<CategoryResponseDto>> GetAllAsync(CancellationToken token) => db.Categories.AsNoTracking()
        .OrderBy(category => category.Id).Select(category => new CategoryResponseDto(category.Id, category.Name, category.Description)).ToListAsync(token);

    public async Task<CategoryResponseDto> GetByIdAsync(int id, CancellationToken token)
    {
        var category = await FindAsync(id, token);
        return new(category.Id, category.Name, category.Description);
    }

    public async Task<CategoryResponseDto> CreateAsync(CategoryInputDto input, CancellationToken token)
    {
        await EnsureNameAsync(input.Name.Trim(), null, token);
        var category = new Category { Name = input.Name.Trim(), Description = input.Description?.Trim() };
        db.Categories.Add(category);
        await db.SaveChangesAsync(token);
        return new(category.Id, category.Name, category.Description);
    }

    public async Task UpdateAsync(int id, CategoryInputDto input, CancellationToken token)
    {
        var category = await FindAsync(id, token);
        await EnsureNameAsync(input.Name.Trim(), id, token);
        category.Name = input.Name.Trim();
        category.Description = input.Description?.Trim();
        await db.SaveChangesAsync(token);
    }

    public async Task DeleteAsync(int id, CancellationToken token)
    {
        var category = await FindAsync(id, token);
        if (await db.Courses.AnyAsync(course => course.CategoryId == id, token))
            throw BusinessException.Conflict("Danh mục đang có khóa học, không thể xóa.");
        db.Categories.Remove(category);
        await db.SaveChangesAsync(token);
    }

    private async Task<Category> FindAsync(int id, CancellationToken token) =>
        await db.Categories.SingleOrDefaultAsync(category => category.Id == id, token)
        ?? throw BusinessException.NotFound("Danh mục không tồn tại.");

    private async Task EnsureNameAsync(string name, int? exceptId, CancellationToken token)
    {
        if (await db.Categories.AnyAsync(category => category.Name == name && category.Id != exceptId, token))
            throw BusinessException.Conflict("Tên danh mục đã tồn tại.");
    }
}
