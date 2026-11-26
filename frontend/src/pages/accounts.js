import { request, query, escapeHtml as esc } from "../api/client.js";
import { icon } from "../components/icons.js";
import { button, linkButton, toolsButton, heading, empty, pagination, avatar } from "../components/ui.js";
import { count, date } from "../utils/format.js";
import { state, view, is } from "../state/store.js";
import { API_DOCS_URL } from "../config.js";
import { ROLE_NAMES as roleName, ROLE_DEFINITIONS, directoryRoles, canResetPassword, canSupportEnrollment, hasPermission } from "../auth/permissions.js";

export async function usersPage(route, version) {
  const params = {
    PageNumber: Math.max(1, Number(route.params.get("page")) || 1),
    PageSize: 10,
    SearchTerm: route.params.get("search") || "",
    Role: is("Admin") ? route.params.get("role") || "" : "User",
    SortBy: "createdat",
    IsDescending: true,
  };
  const result = await request("/users?" + query(params));
  if (version !== view.renderVersion) return "";
  state.users = result;
  const actions = is("Admin")
    ? button(icon("plus") + "Thêm tài khoản", "create-user")
    : "";
  const options = directoryRoles(state.user);
  return (
    heading(
      is("Admin") ? "Quản lý tài khoản" : "Hỗ trợ sinh viên",
      is("Admin")
        ? "Tạo tài khoản và phân quyền Admin, Nhân viên, Giảng viên, User (sinh viên)."
        : "Tra cứu sinh viên, hỗ trợ ghi danh và đặt lại mật khẩu. Khóa có phí cần có đơn đã thanh toán.",
      actions,
    ) +
    `<form id="user-filter" class="toolbar" role="search"><div class="search-field">${icon("search")}<input type="search" name="search" value="${esc(params.SearchTerm)}" placeholder="Tìm theo tên hoặc email…" aria-label="Tìm tài khoản" maxlength="200"/></div><select name="role" aria-label="Vai trò">${is("Admin") ? '<option value="">Tất cả vai trò</option>' : ""}${options.map(([value, label]) => `<option value="${value}" ${value === params.Role ? "selected" : ""}>${label}</option>`).join("")}</select><button type="submit" class="btn btn-secondary btn-sm">Tìm kiếm</button><span class="result-count">${count(result.totalCount)} tài khoản</span></form>${result.items.length ? `<div class="table-wrap"><table><thead><tr><th>Tài khoản</th><th>Vai trò</th><th>Ngày tham gia</th><th style="text-align:right">Thao tác</th></tr></thead><tbody>${result.items.map((user) => `<tr><td><div class="cell-user">${avatar(user.fullName)}<div><strong>${esc(user.fullName)}${user.id === state.user.id ? ' <span class="text-muted">(Bạn)</span>' : ""}</strong><small>${esc(user.email)}</small></div></div></td><td><span class="badge ${user.role === "Admin" ? "purple" : user.role === "Staff" ? "blue" : ""}">${roleName[user.role] || esc(user.role)}</span></td><td>${date(user.createdAt)}</td><td><div class="table-actions">${is("Admin") && user.id !== state.user.id ? toolsButton("shield", "edit-role", user.id, "Thay đổi vai trò") : ""}${canSupportEnrollment(state.user, user) ? toolsButton("plus", "support-enrollment", user.id, "Ghi danh hỗ trợ") : ""}${canResetPassword(state.user, user) ? toolsButton("lock", "reset-password", user.id, "Đặt lại mật khẩu") : ""}${is("Admin") && user.id !== state.user.id ? toolsButton("trash", "delete-user", user.id, "Xóa tài khoản") : ""}</div></td></tr>`).join("")}</tbody></table></div>${pagination(result.pageNumber, Math.max(result.totalPages, 1), result.totalCount)}` : empty("Không có tài khoản phù hợp", "Thử tên, email hoặc vai trò khác.")}`
  );
}

export function profilePage() {
  const user = state.user,
    definition = ROLE_DEFINITIONS[user.role];
  return (
    heading("Tài khoản của bạn", "Thông tin và quyền sử dụng hệ thống.") +
    `<section class="profile-card"><div class="profile-hero">${avatar(user.fullName)}<div><h2>${esc(user.fullName)}</h2><span class="badge ${is("Admin") ? "purple" : is("Staff") ? "blue" : ""}">${roleName[user.role]}</span></div></div><dl class="profile-grid"><div><dt>Họ và tên</dt><dd>${esc(user.fullName)}</dd></div><div><dt>Email</dt><dd>${esc(user.email)}</dd></div><div><dt>Vai trò</dt><dd>${roleName[user.role]}</dd></div><div><dt>Mã tài khoản</dt><dd>#${user.id}</dd></div></dl><div class="form-info">${esc(definition.description)}</div><div class="page-actions">${linkButton("Xem quyền của tôi", "#/permissions")}${button(icon("logout") + "Đăng xuất", "logout", "secondary")}${is("Admin") ? linkButton("Tài liệu API", API_DOCS_URL) : ""}</div></section>`
  );
}
export function permissionsPage() {
  const roles = Object.entries(ROLE_DEFINITIONS);
  const rows = [
    ["Xem thư viện và hồ sơ", null, { Admin: "Có", Staff: "Có", Instructor: "Có", User: "Có" }],
    ["Ghi danh, học bài và cập nhật tiến độ", "learning"],
    ["Quản lý danh mục", "catalog.manage"],
    ["Ghi danh hỗ trợ (miễn phí hoặc đã thanh toán)", "enrollments.support"],
    ["Xuất báo cáo ghi danh và tiến độ CSV", "reports.export"],
    ["Thêm bài giảng, upload và tải học liệu", null, { Admin: "Tất cả khóa", Staff: "Tất cả khóa", Instructor: "Chỉ khóa được giao", User: "Chỉ tải học liệu đã ghi danh" }],
    ["Tạo khóa học", null, { Admin: "Có", Staff: "Có", Instructor: "Có", User: "Không" }],
    ["Sửa khóa học, bài học và học liệu", null, { Admin: "Tất cả khóa", Staff: "Tất cả khóa", Instructor: "Chỉ khóa được giao", User: "Không" }],
    ["Xem ghi danh và tiến độ sinh viên", null, { Admin: "Tất cả khóa", Staff: "Tất cả khóa", Instructor: "Chỉ khóa được giao", User: "Chỉ của mình" }],
    [
      "Xem danh sách tài khoản",
      "directory.read",
      {
        Admin: "Tất cả tài khoản",
        Staff: "Chỉ User (sinh viên)",
        Instructor: "Không",
        User: "Không",
      },
    ],
    ["Tạo và xóa tài khoản", "accounts.manage"],
    ["Đổi vai trò tài khoản", "roles.manage"],
    ["Phân công giảng viên và nhân viên", "staff.assign"],
    [
      "Đặt lại mật khẩu",
      "password.reset",
      {
        Admin: "Tất cả tài khoản",
        Staff: "Chỉ User (sinh viên)",
        Instructor: "Không",
        User: "Không",
      },
    ],
  ];
  return (
    heading(
      "Vai trò & quyền",
      "Bốn vai trò: Admin, Nhân viên, Giảng viên và User (sinh viên).",
      is("Admin") ? linkButton("Quản lý tài khoản", "#/users", "primary") : "",
    ) +
    `<div class="categories-grid roles-grid" style="margin-bottom:24px">${roles.map(([code, role]) => `<article class="category-card"><div class="category-icon">${icon(code === "Admin" ? "shield" : code === "Staff" ? "layers" : "user")}</div><h3>${role.name}</h3><p>${esc(role.description)}</p><footer><span class="badge ${state.user.role === code ? "" : "neutral"}">${state.user.role === code ? "Vai trò của bạn" : code}</span></footer></article>`).join("")}</div><div class="table-wrap"><table><caption class="sr-only">Quyền của bốn vai trò</caption><thead><tr><th>Chức năng</th>${roles.map(([, role]) => `<th>${role.name}</th>`).join("")}</tr></thead><tbody>${rows.map(([label, permission, scope]) => `<tr><td>${label}</td>${roles.map(([code]) => `<td>${scope ? scope[code] : hasPermission({ role: code }, permission) ? "Có" : "Không"}</td>`).join("")}</tr>`).join("")}</tbody></table></div><div class="form-info" style="margin-top:20px">Chỉ Admin được tạo tài khoản quản trị, nhân viên, giảng viên và thay đổi vai trò. Đổi quyền hoặc đặt lại mật khẩu sẽ thu hồi các phiên đăng nhập cũ. User chỉ xem nội dung và tải tài liệu của khóa đã ghi danh.</div>`
  );
}
