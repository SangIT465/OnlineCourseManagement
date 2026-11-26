import { request, escapeHtml as esc } from "../api/client.js";
import { icon } from "../components/icons.js";
import { heading, empty, pagination, avatar, progressBar, button, linkButton } from "../components/ui.js";
import { count, date } from "../utils/format.js";
import { state, is, canManage } from "../state/store.js";
import { hasPermission } from "../auth/permissions.js";

export async function enrollmentsPage(route, _version) {
  if (is("Instructor")) return instructorStudentsPage(route);
  const courseId = Number(route.params.get("course")) || 0,
    search = route.params.get("search") || "";
  let items = state.enrollments;
  if (courseId) items = items.filter((item) => item.courseId === courseId);
  if (search) {
    const term = search.toLocaleLowerCase("vi");
    items = items.filter((item) =>
      `${item.studentName} ${item.studentEmail} ${item.courseName}`
        .toLocaleLowerCase("vi")
        .includes(term),
    );
  }
  const total = items.length,
    totalPages = Math.max(1, Math.ceil(total / 12)),
    page = Math.min(
      totalPages,
      Math.max(1, Number(route.params.get("page")) || 1),
    );
  return (
    heading(
      "Lượt ghi danh",
      "Theo dõi sinh viên và tiến độ trên các khóa học.",
      (hasPermission(state.user, "enrollments.support") ? linkButton("Hỗ trợ ghi danh", "#/users", "secondary") : "") +
      (hasPermission(state.user, "reports.export") ? button(`${icon("download")}Xuất báo cáo CSV`, "export-enrollments", "secondary") : ""),
    ) +
    `<form id="enrollment-filter" class="toolbar"><div class="search-field">${icon("search")}<input type="search" name="search" value="${esc(search)}" placeholder="Tìm sinh viên, khóa học…" aria-label="Tìm ghi danh" maxlength="200"/></div><select name="course" aria-label="Khóa học"><option value="">Tất cả khóa học</option>${state.courses.map((course) => `<option value="${course.id}" ${course.id === courseId ? "selected" : ""}>${esc(course.title)}</option>`).join("")}</select><button type="submit" class="btn btn-secondary btn-sm">Tìm kiếm</button><span class="result-count">${count(total)} lượt ghi danh</span></form>${
      total
        ? `<div class="table-wrap"><table><thead><tr><th>Sinh viên</th><th>Khóa học</th><th>Ngày ghi danh</th><th>Tiến độ</th></tr></thead><tbody>${items
            .slice((page - 1) * 12, page * 12)
            .map(
              (item) =>
                `<tr><td><div class="cell-user">${avatar(item.studentName)}<div><strong>${esc(item.studentName)}</strong><small>${esc(item.studentEmail)}</small></div></div></td><td><a href="#/courses/${item.courseId}">${esc(item.courseName)}</a></td><td>${date(item.enrolledAt)}</td><td><a class="btn btn-secondary btn-sm" href="#/courses/${item.courseId}?tab=students">Xem tiến độ</a></td></tr>`,
            )
            .join(
              "",
            )}</tbody></table></div>${pagination(page, totalPages, total)}`
        : empty(
            "Chưa có lượt ghi danh phù hợp",
            "Các sinh viên ghi danh sẽ xuất hiện tại đây.",
          )
    }`
  );
}
export async function instructorStudentsPage(route) {
  const courses = state.courses.filter((course) => canManage(course));
  const selected = courses.find((course) => course.id === Number(route.params.get("course"))) || courses[0];
  const search = route.params.get("search") || "";
  const result = selected ? await request(`/progress/courses/${selected.id}/students`) : { students: [] };
  const students = result.students.filter((item) => `${item.studentName} ${item.studentEmail}`.toLocaleLowerCase("vi").includes(search.toLocaleLowerCase("vi")));
  return heading("Học viên của tôi", "Theo dõi học viên và tiến độ trong các khóa bạn giảng dạy.") +
    `<form id="enrollment-filter" class="toolbar"><div class="search-field">${icon("search")}<input type="search" name="search" value="${esc(search)}" placeholder="Tìm học viên…" aria-label="Tìm học viên" maxlength="200"/></div><select name="course" aria-label="Khóa học">${courses.map(course => `<option value="${course.id}" ${course.id === selected?.id ? "selected" : ""}>${esc(course.title)}</option>`).join("")}</select><button class="btn btn-secondary btn-sm" type="submit">Tìm kiếm</button><span class="result-count">${count(students.length)} học viên</span></form>` +
    (students.length ? `<div class="table-wrap"><table><thead><tr><th>Học viên</th><th>Ngày ghi danh</th><th>Tiến độ</th></tr></thead><tbody>${students.map(item => `<tr><td><div class="cell-user">${avatar(item.studentName)}<div><strong>${esc(item.studentName)}</strong><small>${esc(item.studentEmail)}</small></div></div></td><td>${date(item.enrolledAt)}</td><td>${progressBar(item)}</td></tr>`).join("")}</tbody></table></div>` : empty(selected ? "Chưa có học viên phù hợp" : "Chưa có khóa học được phân công", selected ? "Học viên ghi danh khóa này sẽ xuất hiện tại đây." : "Tạo khóa học hoặc chờ Admin phân công cho bạn."));
}
