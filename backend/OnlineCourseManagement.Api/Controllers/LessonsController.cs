using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OnlineCourseManagement.DTOs;
using OnlineCourseManagement.DTOs.Common;
using OnlineCourseManagement.Security;
using OnlineCourseManagement.Services;

namespace OnlineCourseManagement.Controllers;

[ApiController]
[Route("api/lessons")]
public sealed class LessonsController(ILessonService lessons) : ControllerBase
{
    /// <summary>Public lesson metadata; learning content requires enrollment or management rights.</summary>
    [AllowAnonymous]
    [HttpGet]
    public async Task<ActionResult<List<LessonSummaryDto>>> GetAll(CancellationToken token) => Ok(await lessons.GetAllAsync(token));

    [AllowAnonymous]
    [HttpGet("paged")]
    public async Task<ActionResult<PagedResult<LessonSummaryDto>>> GetPage([FromQuery] LessonQueryParameters query, CancellationToken token) =>
        Ok(await lessons.GetPageAsync(query, token));

    [AllowAnonymous]
    [HttpGet("course/{courseId:int}")]
    public async Task<ActionResult<List<LessonSummaryDto>>> GetByCourse(int courseId, CancellationToken token) =>
        Ok(await lessons.GetByCourseAsync(courseId, token));

    [Authorize]
    [HttpGet("{id:int}")]
    public async Task<ActionResult<LessonResponseDto>> GetById(int id, CancellationToken token) =>
        Ok(await lessons.GetByIdAsync(id, User, token));

    [Authorize(Policy = AppPolicies.CourseEditing)]
    [HttpPost]
    [ProducesResponseType(typeof(LessonCreatedDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> Create([FromBody] CreateLessonDto input, CancellationToken token)
    {
        var lesson = await lessons.CreateAsync(input, User, token);
        return CreatedAtAction(nameof(GetById), new { id = lesson.Id },
            new LessonCreatedDto("Thêm bài học thành công", lesson.Id, lesson.Title));
    }

    [Authorize(Policy = AppPolicies.CourseEditing)]
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateLessonDto input, CancellationToken token)
    {
        await lessons.UpdateAsync(id, input, User, token);
        return Ok(new { message = "Cập nhật bài học thành công" });
    }

    [Authorize(Policy = AppPolicies.CourseEditing)]
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken token)
    {
        await lessons.DeleteAsync(id, User, token);
        return Ok(new { message = "Xóa bài học thành công" });
    }
}
