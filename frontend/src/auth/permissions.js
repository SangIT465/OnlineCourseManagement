export const ROLE_DEFINITIONS = {
  Admin: {
    name: "Admin",
    description:
      "Quản lý toàn bộ hệ thống, tài khoản, phân quyền và phân công giảng viên, nhân viên phụ trách khóa học.",
    permissions: [
      "catalog.manage",
      "directory.read",
      "accounts.manage",
      "roles.manage",
      "staff.assign",
      "password.reset",
      "enrollments.read",
    ],
  },
  Staff: {
    name: "Nhân viên",
    description:
      "Quản lý danh mục, khóa học, bài học và học liệu; xem ghi danh, tiến độ và hỗ trợ đặt lại mật khẩu cho sinh viên.",
    permissions: [
      "catalog.manage",
      "directory.read",
      "password.reset",
      "enrollments.read",
    ],
  },
  Instructor: {
    name: "Giảng viên",
    description: "Tạo khóa học và quản lý nội dung, học liệu, học viên và tiến độ của các khóa mình giảng dạy. Không quản lý tài khoản hoặc khóa của người khác.",
    permissions: ["courses.create", "courses.own.manage", "enrollments.own.read"],
  },
  User: {
    name: "User (sinh viên)",
    description:
      "Ghi danh khóa học, xem bài học và tài liệu đã đăng ký, theo dõi tiến độ học tập của chính mình.",
    permissions: ["learning"],
  },
};

export const ROLE_NAMES = Object.fromEntries(
  Object.entries(ROLE_DEFINITIONS).map(([code, role]) => [code, role.name]),
);
export const hasPermission = (user, permission) =>
  Object.hasOwn(ROLE_DEFINITIONS, user?.role) &&
  ROLE_DEFINITIONS[user.role].permissions.includes(permission);
export const canManageCatalog = (user) => hasPermission(user, "catalog.manage");
export const canCreateCourse = (user) => canManageCatalog(user) || hasPermission(user, "courses.create");
export const canManageCourse = (user, course) => canManageCatalog(user) ||
  (user?.role === "Instructor" && Number.isInteger(user.id) && course?.instructorId === user.id);
export const canResetPassword = (actor, target) =>
  actor?.role === "Admin" ||
  (actor?.role === "Staff" && target?.role === "User");
export const directoryRoles = (user) =>
  user?.role === "Admin"
    ? Object.entries(ROLE_NAMES)
    : user?.role === "Staff"
      ? [["User", ROLE_NAMES.User]]
      : [];

export function canAccessPage(user, page) {
  if (["dashboard", "courses", "categories"].includes(page)) return true;
  if (!Object.hasOwn(ROLE_DEFINITIONS, user?.role)) return false;
  if (["permissions", "profile", "lesson"].includes(page)) return true;
  if (page === "users") return hasPermission(user, "directory.read");
  if (page === "enrollments") return hasPermission(user, "enrollments.read") || hasPermission(user, "enrollments.own.read");
  if (page === "progress") return hasPermission(user, "learning");
  if (page === "my-courses")
    return ["User", "Staff", "Instructor"].includes(user.role);
  return false;
}
