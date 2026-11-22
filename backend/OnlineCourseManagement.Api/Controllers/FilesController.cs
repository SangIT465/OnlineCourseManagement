using OnlineCourseManagement.Security;
using OnlineCourseManagement.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OnlineCourseManagement.Data;
using OnlineCourseManagement.Models;
using System.Security.Claims;

namespace OnlineCourseManagement.Controllers;

[ApiController]
[Route("api/files")]
public class FilesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IFileStorage _storage;
    private readonly ICourseAccessService _access;

    public FilesController(AppDbContext db, IFileStorage storage, ICourseAccessService access)
    {
        _db = db;
        _storage = storage;
        _access = access;
    }

    private int? CurrentUserId()
    {
        var value = User.FindFirstValue(
            ClaimTypes.NameIdentifier);

        return int.TryParse(value, out var id)
            ? id : null;
    }

    private Task<bool> CanManage(Course course) => _access.CanManageAsync(User, course);

    // POST: api/files/courses/1/image
    [Authorize(Policy = AppPolicies.CourseEditing)]
    [HttpPost("courses/{courseId:int}/image")]
    public async Task<IActionResult> UploadCourseImage(
        int courseId,
        IFormFile file)
    {
        var course = await _db.Courses
            .FindAsync(courseId);

        if (course == null)
            return NotFound("Khóa học không tồn tại");

        if (!await CanManage(course))
            return Forbid();

        return await SaveFile(
            file, "CourseImage", courseId, null);
    }

    // POST: api/files/lessons/1/document
    [Authorize(Policy = AppPolicies.CourseEditing)]
    [HttpPost("lessons/{lessonId:int}/document")]
    public async Task<IActionResult> UploadLessonDocument(
        int lessonId,
        IFormFile file)
    {
        var lesson = await _db.Lessons
            .Include(l => l.Course)
            .FirstOrDefaultAsync(l => l.Id == lessonId);

        if (lesson == null)
            return NotFound("Bài học không tồn tại");

        if (lesson.Course == null ||
            !await CanManage(lesson.Course))
            return Forbid();

        return await SaveFile(
            file, "LessonDocument",
            lesson.CourseId, lesson.Id);
    }

    private async Task<IActionResult> SaveFile(IFormFile file, string type, int courseId, int? lessonId)
    {
        var stored = await _storage.SaveAsync(file, type, HttpContext.RequestAborted);
        var record = new UploadedFile
        {
            OriginalName = Path.GetFileName(file.FileName), StoredName = stored.StoredName,
            ContentType = stored.ContentType, Size = stored.Size, FileType = type,
            CourseId = courseId, LessonId = lessonId, UploadedById = User.RequireUserId()
        };
        try
        {
            _db.UploadedFiles.Add(record);
            await _db.SaveChangesAsync(HttpContext.RequestAborted);
        }
        catch
        {
            _storage.Delete(type, stored.StoredName);
            throw;
        }
        return StatusCode(201, new { message = "Upload thành công", record.Id, record.OriginalName, record.Size, record.FileType });
    }

    // GET: api/files/1/download
    [Authorize]
    [HttpGet("{id:int}/download")]
    public async Task<IActionResult> Download(int id)
    {
        var file = await _db.UploadedFiles
            .AsNoTracking()
            .FirstOrDefaultAsync(f => f.Id == id);

        if (file == null)
            return NotFound();

        // Tài liệu cần quyền học hoặc quyền quản lý
        var course = await _db.Courses
            .AsNoTracking()
            .FirstOrDefaultAsync(c =>
                c.Id == file.CourseId);

        if (course == null)
            return NotFound();

        bool allowed = await CanManage(course);

        if (!allowed && User.IsInRole(AppRoles.User))
        {
            var userId = CurrentUserId();

            allowed = userId.HasValue &&
                await _db.Enrollments.AnyAsync(e =>
                    e.StudentId == userId.Value &&
                    e.CourseId == course.Id);
        }

        if (!allowed)
            return Forbid();

        var folder = file.FileType switch
        {
            "CourseImage" => "course-images",
            "LessonDocument" => "lesson-documents",
            _ => null
        };

        if (folder == null)
            return NotFound();

        var path = _storage.GetPath(file.FileType, file.StoredName);

        if (!System.IO.File.Exists(path))
            return NotFound("File không tồn tại trên ổ đĩa");

        var stream = new FileStream(
            path, FileMode.Open, FileAccess.Read,
            FileShare.Read);

        return File(
            stream,
            file.ContentType,
            file.OriginalName);
    }

    // GET: api/files/courses/1
    [AllowAnonymous]
    [HttpGet("courses/{courseId:int}")]
    public async Task<IActionResult> GetFiles(int courseId)
    {
        var exists = await _db.Courses
            .AnyAsync(c => c.Id == courseId);

        if (!exists)
            return NotFound();

        // Chỉ liệt kê ảnh bìa công khai
        var files = await _db.UploadedFiles
            .AsNoTracking()
            .Where(f =>
                f.CourseId == courseId &&
                f.FileType == "CourseImage")
            .Select(f => new
            {
                f.Id,
                f.OriginalName,
                f.Size,
                f.UploadedAt
            })
            .ToListAsync();

        return Ok(files);
    }

    // GET: api/files/lessons/1
    [Authorize]
    [HttpGet("lessons/{lessonId:int}")]
    public async Task<IActionResult> GetLessonFiles(
        int lessonId)
    {
        var lesson = await _db.Lessons
            .AsNoTracking()
            .Include(l => l.Course)
            .FirstOrDefaultAsync(l => l.Id == lessonId);

        if (lesson == null)
            return NotFound();

        if (lesson.Course == null)
            return NotFound();

        bool allowed = await CanManage(lesson.Course);

        if (!allowed && User.IsInRole(AppRoles.User))
        {
            var userId = CurrentUserId();

            allowed = userId.HasValue &&
                await _db.Enrollments.AnyAsync(e =>
                    e.StudentId == userId.Value &&
                    e.CourseId == lesson.CourseId);
        }

        if (!allowed)
            return Forbid();

        var files = await _db.UploadedFiles
            .AsNoTracking()
            .Where(f =>
                f.LessonId == lessonId &&
                f.FileType == "LessonDocument")
            .Select(f => new
            {
                f.Id,
                f.OriginalName,
                f.Size,
                f.UploadedAt
            })
            .ToListAsync();

        return Ok(files);
    }

    // DELETE: api/files/1
    [Authorize(Policy = AppPolicies.CourseEditing)]
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var file = await _db.UploadedFiles
            .FirstOrDefaultAsync(f => f.Id == id);

        if (file == null)
            return NotFound();

        var course = await _db.Courses
            .FirstOrDefaultAsync(c =>
                c.Id == file.CourseId);

        if (course == null)
            return NotFound();

        if (!await CanManage(course))
            return Forbid();

        var folder = file.FileType switch
        {
            "CourseImage" => "course-images",
            "LessonDocument" => "lesson-documents",
            _ => null
        };

        if (folder == null)
            return BadRequest("Loại file không hợp lệ");

        var path = _storage.GetPath(file.FileType, file.StoredName);

        _db.UploadedFiles.Remove(file);
        await _db.SaveChangesAsync();

        if (System.IO.File.Exists(path))
            System.IO.File.Delete(path);

        return Ok(new
        {
            message = "Xóa file thành công"
        });
    }
}