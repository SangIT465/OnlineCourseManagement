using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OnlineCourseManagement.Security;
using OnlineCourseManagement.Services;

namespace OnlineCourseManagement.Controllers;

[ApiController]
[Route("api/progress")]
[Authorize]
public sealed class LessonProgressController(ILessonProgressService progress) : ControllerBase
{
    [Authorize(Policy = AppPolicies.Learning)]
    [HttpPost("lessons/{lessonId:int}/complete")]
    public async Task<IActionResult> CompleteLesson(int lessonId, CancellationToken token)
    {
        var lesson = await progress.CompleteAsync(lessonId, User, token);
        return Ok(new
        {
            message = "Đã hoàn thành bài học",
            lesson.LessonId, lesson.IsCompleted, lesson.CompletedAt
        });
    }

    [Authorize(Policy = AppPolicies.Learning)]
    [HttpDelete("lessons/{lessonId:int}/complete")]
    public async Task<IActionResult> UndoComplete(int lessonId, CancellationToken token)
    {
        var lesson = await progress.UndoCompleteAsync(lessonId, User, token);
        return Ok(new { message = "Đã hủy trạng thái hoàn thành", lesson.LessonId, lesson.IsCompleted });
    }

    [Authorize(Policy = AppPolicies.Learning)]
    [HttpGet("courses/{courseId:int}")]
    public async Task<IActionResult> GetCourseProgress(int courseId, CancellationToken token)
    {
        var course = await progress.GetCourseAsync(courseId, User, token);
        return course is null ? NotFound() : Ok(course);
    }

    [Authorize(Policy = AppPolicies.Learning)]
    [HttpGet("my")]
    public async Task<IActionResult> MyProgress(CancellationToken token) =>
        Ok(await progress.GetMineAsync(User, token));

    [Authorize(Policy = AppPolicies.CourseEditing)]
    [HttpGet("courses/{courseId:int}/students")]
    public async Task<IActionResult> GetStudentsProgress(int courseId, CancellationToken token)
    {
        var students = await progress.GetStudentsAsync(courseId, User, token);
        return students is null ? NotFound() : Ok(students);
    }
}
