using System.Security.Claims;
using OnlineCourseManagement.Models;

namespace OnlineCourseManagement.Security;

public static class AppRoles
{
    public const string Admin = "Admin";
    public const string Staff = "Staff";
    public const string Instructor = "Instructor";
    public const string User = "User";
    public const string CatalogManagers = Admin + "," + Staff;
    public const string CourseEditors = CatalogManagers + "," + Instructor;
    public const string AssignedOperators = Staff + "," + Instructor;
    public const string SecurityStampClaim = "security_stamp";

    public static readonly string[] All = [Admin, Staff, Instructor, User];

    public static string? Normalize(string? value) => All.FirstOrDefault(
        role => role.Equals(value?.Trim(), StringComparison.OrdinalIgnoreCase));

    public static bool CanManageCatalog(ClaimsPrincipal principal) =>
        principal.IsInRole(Admin) || principal.IsInRole(Staff);

    public static bool CanManageCourse(ClaimsPrincipal principal, Course course) =>
        CanManageCatalog(principal) ||
        (principal.IsInRole(Instructor) &&
         int.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out var id) &&
         course.InstructorId == id);
}
