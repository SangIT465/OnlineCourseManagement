using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OnlineCourseManagement.DTOs;
using OnlineCourseManagement.Security;
using OnlineCourseManagement.Services;

namespace OnlineCourseManagement.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public sealed class EnrollmentsController(IEnrollmentService enrollments) : ControllerBase
{
    [Authorize(Policy = AppPolicies.Learning)]
    [HttpPost]
    public async Task<IActionResult> Enroll([FromBody] EnrollCourseDto input, CancellationToken token)
    {
        var enrollment = await enrollments.EnrollAsync(input, User, token);
        return StatusCode(StatusCodes.Status201Created, new
        {
            message = "Đăng ký khóa học thành công",
            enrollment.Id, enrollment.StudentId, enrollment.CourseId, enrollment.EnrolledAt
        });
    }

    [Authorize(Policy = AppPolicies.Learning)]
    [HttpGet("my")]
    public async Task<IActionResult> MyCourses(CancellationToken token) =>
        Ok(await enrollments.GetMineAsync(User, token));

    [Authorize(Policy = AppPolicies.CatalogManagement)]
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken token) =>
        Ok(await enrollments.GetAllAsync(token));

    [Authorize(Policy = AppPolicies.CourseEditing)]
    [HttpGet("course/{courseId:int}")]
    public async Task<IActionResult> GetStudents(int courseId, CancellationToken token) =>
        Ok(await enrollments.GetStudentsAsync(courseId, User, token));

    [Authorize(Policy = AppPolicies.Learning)]
    [HttpDelete("{courseId:int}")]
    public async Task<IActionResult> Cancel(int courseId, CancellationToken token)
    {
        await enrollments.CancelAsync(courseId, User, token);
        return Ok(new { message = "Hủy đăng ký thành công" });
    }
}
