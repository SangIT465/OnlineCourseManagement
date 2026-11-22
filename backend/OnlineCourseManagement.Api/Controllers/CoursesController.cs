using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OnlineCourseManagement.DTOs;
using OnlineCourseManagement.DTOs.Common;
using OnlineCourseManagement.Security;
using OnlineCourseManagement.Services;

namespace OnlineCourseManagement.Controllers;

[ApiController]
[Route("api/courses")]
public sealed class CoursesController(ICourseService courses) : ControllerBase
{
    /// <summary>Public course catalog. Retains the array response used by the frontend.</summary>
    [HttpGet]
    public async Task<ActionResult<List<CourseResponseDto>>> GetAll(
        [FromQuery, MaxLength(200)] string? search, [FromQuery, Range(1, int.MaxValue)] int? categoryId, CancellationToken token) =>
        Ok(await courses.GetAllAsync(search, categoryId, token));

    /// <summary>Search, filter, sort and paginate the public course catalog.</summary>
    [HttpGet("paged")]
    public async Task<ActionResult<PagedResult<CourseResponseDto>>> GetPage([FromQuery] CourseQueryParameters query, CancellationToken token) =>
        Ok(await courses.GetPageAsync(query, token));

    [HttpGet("{id:int}")]
    public async Task<ActionResult<CourseResponseDto>> GetById(int id, CancellationToken token) =>
        Ok(await courses.GetByIdAsync(id, token));

    [Authorize(Roles = AppRoles.AssignedOperators)]
    [HttpGet("my")]
    public async Task<ActionResult<List<CourseResponseDto>>> MyCourses(CancellationToken token) =>
        Ok(await courses.GetMineAsync(User, token));

    /// <summary>Create a course. Instructor and Staff ownership are assigned from the authenticated account.</summary>
    [Authorize(Policy = AppPolicies.CourseEditing)]
    [HttpPost]
    [ProducesResponseType(typeof(CourseCreatedDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> Create([FromBody] CreateCourseDto input, CancellationToken token)
    {
        var course = await courses.CreateAsync(input, User, token);
        return CreatedAtAction(nameof(GetById), new { id = course.Id },
            new CourseCreatedDto("Tạo khóa học thành công", course.Id, course.Title, course.InstructorId, course.StaffId));
    }

    [Authorize(Policy = AppPolicies.CourseEditing)]
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateCourseDto input, CancellationToken token)
    {
        await courses.UpdateAsync(id, input, User, token);
        return Ok(new { message = "Cập nhật thành công" });
    }

    [Authorize(Policy = AppPolicies.AccountAdministration)]
    [HttpPut("{id:int}/staff")]
    public Task<IActionResult> AssignStaff(int id, [FromBody] AssignStaffDto input, CancellationToken token) =>
        Assign(id, input.StaffId, AppRoles.Staff, token);

    [Authorize(Policy = AppPolicies.AccountAdministration)]
    [HttpPut("{id:int}/instructor")]
    public Task<IActionResult> AssignInstructor(int id, [FromBody] AssignInstructorDto input, CancellationToken token) =>
        Assign(id, input.InstructorId, AppRoles.Instructor, token);

    private async Task<IActionResult> Assign(int id, int operatorId, string role, CancellationToken token)
    {
        var course = await courses.AssignAsync(id, operatorId, role, User, token);
        return Ok(new { message = "Phân công thành công", course.Id, course.InstructorId, course.StaffId,
            AssignedRole = role, AssignedName = role == AppRoles.Staff ? course.StaffName : course.InstructorName });
    }

    [Authorize(Policy = AppPolicies.CourseEditing)]
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken token)
    {
        await courses.DeleteAsync(id, User, token);
        return Ok(new { message = "Xóa khóa học thành công" });
    }
}
