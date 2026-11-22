namespace OnlineCourseManagement.Security;

public static class AppPermissions
{
    public const string ClaimType = "permission";
    public const string CatalogManage = "catalog.manage";
    public const string CourseWrite = "course.write";
    public const string AccountsManage = "accounts.manage";
    public const string StudentsSupport = "students.support";
    public const string Learning = "learning";

    public static string[] ForRole(string role) => role switch
    {
        AppRoles.Admin => [CatalogManage, CourseWrite, AccountsManage, StudentsSupport],
        AppRoles.Staff => [CatalogManage, CourseWrite, StudentsSupport],
        AppRoles.Instructor => [CourseWrite],
        AppRoles.User => [Learning],
        _ => []
    };
}
