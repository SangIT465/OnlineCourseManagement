using OnlineCourseManagement.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OnlineCourseManagement.Data;
using OnlineCourseManagement.DTOs;
using OnlineCourseManagement.Models;
using System.Security.Claims;

namespace OnlineCourseManagement.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CoursesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public CoursesController(AppDbContext context)
        {
            _context = context;
        }

        private int? CurrentUserId()
        {
            var id = User.FindFirstValue(
                ClaimTypes.NameIdentifier);

            return int.TryParse(id, out var userId)
                ? userId
                : null;
        }

        private bool CanManage(Course course) => AppRoles.CanManageCourse(User, course);

        // GET: api/courses
        [HttpGet]
        public async Task<IActionResult> GetAll(
            [FromQuery] string? search,
            [FromQuery] int? categoryId)
        {
            var query = _context.Courses
                .AsNoTracking()
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(search))
                query = query.Where(c =>
                    c.Title.Contains(search));

            if (categoryId.HasValue)
                query = query.Where(c =>
                    c.CategoryId == categoryId.Value);

            var courses = await query
                .OrderByDescending(c => c.CreatedAt)
                .Select(c => new
                {
                    c.Id,
                    c.Title,
                    c.Description,
                    c.Price,
                    c.CategoryId,
                    CategoryName = c.Category != null
                        ? c.Category.Name : null,
                    c.InstructorId,
                    c.StaffId,
                    StaffName = c.Staff != null ? c.Staff.FullName : null,
                    InstructorName = c.Instructor != null
                        ? c.Instructor.FullName : null,
                    c.CreatedAt
                })
                .ToListAsync();

            return Ok(courses);
        }

        // GET: api/courses/{id}
        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetById(int id)
        {
            var course = await _context.Courses
                .AsNoTracking()
                .Where(c => c.Id == id)
                .Select(c => new
                {
                    c.Id,
                    c.Title,
                    c.Description,
                    c.Price,
                    c.CategoryId,
                    CategoryName = c.Category != null
                        ? c.Category.Name : null,
                    c.InstructorId,
                    c.StaffId,
                    StaffName = c.Staff != null ? c.Staff.FullName : null,
                    InstructorName = c.Instructor != null
                        ? c.Instructor.FullName : null,
                    c.CreatedAt
                })
                .FirstOrDefaultAsync();

            if (course == null)
                return NotFound();

            return Ok(course);
        }

        // GET: api/courses/my
        [Authorize(Roles = AppRoles.AssignedOperators)]
        [HttpGet("my")]
        public async Task<IActionResult> MyCourses()
        {
            var userId = CurrentUserId();

            if (userId == null)
                return Unauthorized();

            var isInstructor = User.IsInRole(AppRoles.Instructor);
            var courses = await _context.Courses
                .AsNoTracking()
                .Where(c => isInstructor ? c.InstructorId == userId : c.StaffId == userId)
                .OrderByDescending(c => c.CreatedAt)
                .Select(c => new
                {
                    c.Id,
                    c.Title,
                    c.Description,
                    c.Price,
                    c.CategoryId,
                    c.InstructorId,
                    c.StaffId
                })
                .ToListAsync();

            return Ok(courses);
        }

        // POST: api/courses
        [Authorize(Roles = AppRoles.CourseEditors)]
        [HttpPost]
        public async Task<IActionResult> Create(
            [FromBody] CreateCourseDto dto)
        {
            if (!await _context.Categories
                .AnyAsync(c => c.Id == dto.CategoryId))
            {
                return BadRequest(new
                {
                    message = "Danh mục không tồn tại"
                });
            }

            var userId = CurrentUserId();

            if (userId == null)
                return Unauthorized();

            var course = new Course
            {
                Title = dto.Title,
                Description = dto.Description,
                Price = dto.Price,
                CategoryId = dto.CategoryId,
                InstructorId = User.IsInRole(AppRoles.Instructor)
                    ? userId : null,
                StaffId = User.IsInRole(AppRoles.Staff) ? userId : null,
                CreatedAt = DateTime.UtcNow
            };

            _context.Courses.Add(course);
            await _context.SaveChangesAsync();

            return CreatedAtAction(
                nameof(GetById),
                new { id = course.Id },
                new
                {
                    message = "Tạo khóa học thành công",
                    course.Id,
                    course.Title,
                    course.InstructorId,
                    course.StaffId
                });
        }

        // PUT: api/courses/{id}
        [Authorize(Roles = AppRoles.CourseEditors)]
        [HttpPut("{id:int}")]
        public async Task<IActionResult> Update(
            int id,
            [FromBody] UpdateCourseDto dto)
        {
            var course = await _context.Courses
                .FindAsync(id);

            if (course == null)
                return NotFound();

            if (!CanManage(course))
                return Forbid();

            if (!await _context.Categories
                .AnyAsync(c => c.Id == dto.CategoryId))
            {
                return BadRequest(new
                {
                    message = "Danh mục không tồn tại"
                });
            }

            course.Title = dto.Title;
            course.Description = dto.Description;
            course.Price = dto.Price;
            course.CategoryId = dto.CategoryId;

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Cập nhật thành công"
            });
        }

        [Authorize(Roles = AppRoles.Admin)]
        [HttpPut("{id:int}/staff")]
        public Task<IActionResult> AssignStaff(int id, [FromBody] AssignStaffDto dto) =>
            AssignCourseOperator(id, dto.StaffId, AppRoles.Staff);

        // Teaching assignment is separate from the operational Staff assignment.
        [Authorize(Roles = AppRoles.Admin)]
        [HttpPut("{id:int}/instructor")]
        public Task<IActionResult> AssignInstructor(
            int id,
            [FromBody] AssignInstructorDto dto) => AssignCourseOperator(id, dto.InstructorId, AppRoles.Instructor);

        private async Task<IActionResult> AssignCourseOperator(int id, int operatorId, string role)
        {
            var course = await _context.Courses
                .FindAsync(id);

            if (course == null)
                return NotFound();

            var instructor = await _context.Users
                .FirstOrDefaultAsync(u =>
                    u.Id == operatorId &&
                    u.Role == role);

            if (instructor == null)
                return BadRequest(new
                {
                    message = "Tài khoản được phân công không tồn tại hoặc không đúng vai trò."
                });

            if (role == AppRoles.Instructor) course.InstructorId = instructor.Id;
            else course.StaffId = instructor.Id;
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Phân công thành công",
                course.Id,
                course.InstructorId,
                course.StaffId,
                AssignedRole = role,
                AssignedName = instructor.FullName
            });
        }

        // DELETE: api/courses/{id}
        [Authorize(Roles = AppRoles.CourseEditors)]
        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            var course = await _context.Courses
                .FindAsync(id);

            if (course == null)
                return NotFound();

            if (!CanManage(course))
                return Forbid();

            // Tránh xóa khóa học đã có bài học.
            if (await _context.Lessons
                .AnyAsync(l => l.CourseId == id))
            {
                return Conflict(new
                {
                    message =
                        "Hãy xử lý các bài học trước khi xóa khóa học"
                });
            }

            _context.Courses.Remove(course);

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException)
            {
                return Conflict(new
                {
                    message =
                        "Khóa học có dữ liệu liên quan, không thể xóa"
                });
            }

            return Ok(new
            {
                message = "Xóa khóa học thành công"
            });
        }
    }
}
