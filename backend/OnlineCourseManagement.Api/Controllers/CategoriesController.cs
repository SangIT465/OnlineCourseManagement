using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OnlineCourseManagement.DTOs;
using OnlineCourseManagement.Security;
using OnlineCourseManagement.Services;

namespace OnlineCourseManagement.Controllers;

[ApiController]
[Route("api/categories")]
public sealed class CategoriesController(ICategoryService categories) : ControllerBase
{
    [AllowAnonymous]
    [HttpGet]
    public async Task<ActionResult<List<CategoryResponseDto>>> GetAll(CancellationToken token) => Ok(await categories.GetAllAsync(token));

    [AllowAnonymous]
    [HttpGet("{id:int}")]
    public async Task<ActionResult<CategoryResponseDto>> GetById(int id, CancellationToken token) => Ok(await categories.GetByIdAsync(id, token));

    [Authorize(Policy = AppPolicies.CatalogManagement)]
    [HttpPost]
    [ProducesResponseType(typeof(CategoryResponseDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> Create([FromBody] CategoryInputDto input, CancellationToken token)
    {
        var category = await categories.CreateAsync(input, token);
        return CreatedAtAction(nameof(GetById), new { id = category.Id }, category);
    }

    [Authorize(Policy = AppPolicies.CatalogManagement)]
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] CategoryInputDto input, CancellationToken token)
    {
        await categories.UpdateAsync(id, input, token);
        return NoContent();
    }

    [Authorize(Policy = AppPolicies.CatalogManagement)]
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken token)
    {
        await categories.DeleteAsync(id, token);
        return NoContent();
    }
}
