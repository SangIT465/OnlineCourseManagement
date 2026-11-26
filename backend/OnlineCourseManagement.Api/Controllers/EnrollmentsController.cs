using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OnlineCourseManagement.DTOs;
using OnlineCourseManagement.Security;
using OnlineCourseManagement.Services;
using System.Text;

namespace OnlineCourseManagement.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public sealed class EnrollmentsController(IEnrollmentService enrollments) : ControllerBase
{
    /// <summary>Staff/Admin enroll a User in a free course or restore access backed by a paid purchase.</summary>
    [Authorize(Policy = AppPolicies.StudentSupport)]
    [HttpPost("support")]
    [ProducesResponseType(typeof(EnrollmentResponseDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> SupportEnroll([FromBody] SupportEnrollmentDto input, CancellationToken token) =>
        StatusCode(StatusCodes.Status201Created, await enrollments.SupportEnrollAsync(input, User, token));

    /// <summary>Export current enrollment and learning progress from SQL Server as an Excel-compatible CSV.</summary>
    [Authorize(Policy = AppPolicies.CatalogManagement)]
    [HttpGet("export")]
    [Produces("text/csv")]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    public async Task<IActionResult> Export([FromQuery] EnrollmentReportQuery input, CancellationToken token)
    {
        var csv = EnrollmentReport.Render(await enrollments.GetReportAsync(input, token));
        Response.Headers.CacheControl = "private, no-store";
        return File(Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(csv)).ToArray(),
            "text/csv; charset=utf-8", "bao-cao-tien-do.csv");
    }

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
