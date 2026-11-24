import { request, escapeHtml as esc } from "../api/client.js";
import { icon } from "../components/icons.js";
import { button, linkButton, toolsButton, empty, heading, courseCard, cover, progressBar, pagination, fileRow, avatar } from "../components/ui.js";
import { count, money, date } from "../utils/format.js";
import { state, view, is, canCreate, canManage, enrolled, lessonsFor, categoryName } from "../state/store.js";
import { canManageCatalog } from "../auth/permissions.js";
import { renderManagementCourses } from "../features/workspaces.js";

export function coursesPage(route, mine = false, progressOnly = false) {
  let courses = mine
    ? state.courses.filter((course) =>
        is("Staff") ? course.staffId === state.user.id : is("Instructor") ? canManage(course) : enrolled(course.id),
      )
    : state.courses;
  const search = route.params.get("search") || "",
    category = route.params.get("category") || "",
    price = route.params.get("price") || "",
    sort = route.params.get("sort") || "newest";
  if (search) {
    const term = search.toLocaleLowerCase("vi").normalize("NFC");
    courses = courses.filter((course) =>
      `${course.title} ${course.description || ""} ${course.instructorName || ""} ${course.staffName || ""}`
        .toLocaleLowerCase("vi")
        .normalize("NFC")
        .includes(term),
    );
  }
  if (category)
    courses = courses.filter(
      (course) => course.categoryId === Number(category),
    );
  if (price)
    courses = courses.filter((course) =>
      price === "free" ? Number(course.price) === 0 : Number(course.price) > 0,
    );
  if (sort === "price-asc")
    courses = courses.toSorted((a, b) => a.price - b.price);
  if (sort === "price-desc")
    courses = courses.toSorted((a, b) => b.price - a.price);
  if (sort === "name")
    courses = courses.toSorted((a, b) => a.title.localeCompare(b.title, "vi"));
  const pageSize = 9,
    total = courses.length,
    totalPages = Math.max(1, Math.ceil(total / pageSize)),
    page = Math.min(
      totalPages,
      Math.max(1, Number(route.params.get("page")) || 1),
    );
  const shown = courses.slice((page - 1) * pageSize, page * pageSize);
  const title = progressOnly
    ? "Tiến độ học tập"
    : mine
      ? is("Staff")
        ? "Khóa học phụ trách"
        : is("Instructor") ? "Khóa tôi giảng dạy" : "Khóa học của tôi"
      : is("Admin") ? "Quản lý khóa học" : "Khám phá khóa học";
  const subtitle = progressOnly
    ? "Mỗi bài học hoàn thành là một bước gần hơn với mục tiêu."
    : mine
      ? "Một nơi cho tất cả những bước tiến của bạn."
      : is("Admin") ? "Quản lý nội dung, học phí và phân công giảng viên trong thư viện." : "Tìm kiến thức bạn cần. Xây dựng kỹ năng bạn muốn.";
  return (
    heading(
      title,
      subtitle,
      canCreate() ? button(`${icon("plus")}Tạo khóa học`, "create-course") : "",
    ) +
    `<form id="course-filter" class="toolbar" role="search"><div class="search-field">${icon("search")}<input type="search" name="search" value="${esc(search)}" placeholder="Tên khóa học, giảng viên…" aria-label="Tìm khóa học" maxlength="200" /></div><select name="category" aria-label="Lọc theo danh mục"><option value="">Tất cả danh mục</option>${state.categories.map((item) => `<option value="${item.id}" ${category === String(item.id) ? "selected" : ""}>${esc(item.name)}</option>`).join("")}</select><select name="price" aria-label="Lọc theo học phí"><option value="">Tất cả học phí</option><option value="free" ${price === "free" ? "selected" : ""}>Miễn phí</option><option value="paid" ${price === "paid" ? "selected" : ""}>Có học phí</option></select><select name="sort" aria-label="Sắp xếp khóa học"><option value="newest">Mới nhất</option><option value="name" ${sort === "name" ? "selected" : ""}>Tên A–Z</option><option value="price-asc" ${sort === "price-asc" ? "selected" : ""}>Giá tăng dần</option><option value="price-desc" ${sort === "price-desc" ? "selected" : ""}>Giá giảm dần</option></select><button class="btn btn-secondary btn-sm" type="submit">Tìm kiếm</button></form><div class="section-heading"><p>${count(total)} khóa học ${search ? "phù hợp với tìm kiếm" : mine ? "trong không gian của bạn" : "đang chờ bạn khám phá"}</p>${search || category || price ? '<button class="btn btn-ghost btn-sm" data-action="clear-filters">Bỏ bộ lọc</button>' : ""}</div><div class="${is("Admin") ? "workspace-admin-catalog" : "course-grid"}">${shown.length ? (is("Admin") ? renderManagementCourses(shown, { lessons: state.lessons, canEdit: canManage }) : shown.map((course) => courseCard(course, mine || progressOnly)).join("")) : empty(mine ? "Chưa có khóa học nào" : "Không tìm thấy khóa học", mine ? (is("Staff") ? "Tạo khóa học hoặc chờ quản trị viên phân công cho bạn." : "Chọn một khóa học trong thư viện để bắt đầu hành trình.") : "Thử một từ khóa khác hoặc bỏ bớt bộ lọc.", mine ? linkButton("Khám phá khóa học", "#/courses", "primary") : button("Bỏ bộ lọc", "clear-filters", "secondary"))}</div>${totalPages > 1 ? pagination(page, totalPages, total) : ""}`
  );
}

export function categoriesPage() {
  return (
    heading(
      "Những lĩnh vực để khám phá",
      "Mở rộng góc nhìn. Tìm lĩnh vực dành riêng cho bạn.",
      canManageCatalog(state.user)
        ? button(`${icon("plus")}Tạo danh mục`, "create-category")
        : "",
    ) +
    `<div class="categories-grid">${state.categories.length ? state.categories.map((item) => `<article class="category-card"><div class="category-icon">${icon("layers")}</div><h3>${esc(item.name)}</h3><p>${esc(item.description || "Khám phá các khóa học và phát triển kỹ năng trong lĩnh vực này.")}</p><footer><a href="#/courses?category=${item.id}">${count(state.courses.filter((course) => course.categoryId === item.id).length)} khóa học</a>${canManageCatalog(state.user) ? `<div class="table-actions">${toolsButton("edit", "edit-category", item.id, `Sửa ${item.name}`)}${toolsButton("trash", "delete-category", item.id, `Xóa ${item.name}`)}</div>` : ""}</footer></article>`).join("") : empty("Chưa có danh mục", "Danh mục giúp tổ chức và tìm kiếm khóa học dễ dàng hơn.", canManageCatalog(state.user) ? button("Tạo danh mục đầu tiên", "create-category") : "")}</div>`
  );
}
export function detailTabs(course, active) {
  const tabs = [
    ["lessons", `Nội dung khóa học (${lessonsFor(course.id).length})`],
  ];
  if (canManage(course)) tabs.push(["students", "Sinh viên & tiến độ"]);
  tabs.push(["resources", "Học liệu & ảnh bìa"]);
  return `<div class="tabs" role="tablist" aria-label="Thông tin khóa học">${tabs.map(([key, label]) => `<button class="tab ${active === key ? "active" : ""}" role="tab" id="tab-${key}" aria-selected="${active === key}" tabindex="${active === key ? 0 : -1}" aria-controls="detail-tab-panel" data-action="course-tab" data-tab="${key}">${label}</button>`).join("")}</div>`;
}
export async function courseDetail(route, version) {
  const course = await request(`/courses/${route.id}`);
  if (version !== view.renderVersion) return "";
  state.courseDetail = course;
  const lessons = lessonsFor(course.id),
    progress = enrolled(course.id)
      ? await request(`/progress/courses/${course.id}`)
      : null;
  if (version !== view.renderVersion) return "";
  let tab = route.params.get("tab") || "lessons";
  if (
    !["lessons", "students", "resources"].includes(tab) ||
    (tab === "students" && !canManage(course))
  )
    tab = "lessons";
  let actions = "";
  if (canManage(course))
    actions =
      button(
        `${icon("edit")}Sửa khóa học`,
        "edit-course",
        "primary",
        `data-id="${course.id}"`,
      ) +
      button(
        icon("trash"),
        "delete-course",
        "secondary",
        `data-id="${course.id}" aria-label="Xóa khóa học"`,
      );
  else if (enrolled(course.id))
    actions = button(
      "Hủy ghi danh",
      "cancel-enrollment",
      "secondary",
      `data-id="${course.id}"`,
    );
  else if (is("User") || !state.user)
    actions = button(
      `${icon("plus")}${Number(course.price) > 0 ? "Mua khóa học" : "Nhận khóa học miễn phí"}`,
      "enroll",
      "primary",
      `data-id="${course.id}"`,
    );
  else
    actions =
      '<span class="text-small text-muted">Đăng nhập bằng tài khoản sinh viên để ghi danh.</span>';
  let body = "";
  if (tab === "lessons") {
    body = `${progress ? `<div class="progress-summary"><h3>Hành trình của bạn</h3>${progressBar(progress)}</div>` : ""}<div class="section-heading"><h2>Học từng bước, vững từng kỹ năng</h2>${canManage(course) ? button(`${icon("plus")}Thêm bài học`, "create-lesson", "secondary", `data-id="${course.id}"`) : ""}</div><div class="lesson-list">${
      lessons.length
        ? lessons
            .map((lesson) => {
              const done = progress?.lessons.find(
                (item) => item.lessonId === lesson.id,
              )?.isCompleted;
              return `<article class="lesson-row"><span class="lesson-order">${done ? icon("check") : String(lesson.orderIndex).padStart(2, "0")}</span><div class="lesson-main"><strong>${canManage(course) || enrolled(course.id) ? `<a href="#/lesson/${lesson.id}">${esc(lesson.title)}</a>` : esc(lesson.title)}</strong><small>${count(lesson.durationMinutes)} phút${done ? " · Đã hoàn thành" : ""}</small></div><div class="lesson-tools">${canManage(course) ? toolsButton("edit", "edit-lesson", lesson.id, "Sửa bài học") + toolsButton("trash", "delete-lesson", lesson.id, "Xóa bài học") : ""}${canManage(course) || enrolled(course.id) ? linkButton(icon("play"), `#/lesson/${lesson.id}`, "secondary") : toolsButton("lock", "locked-lesson", course.id, "Đăng ký để xem bài học")}</div></article>`;
            })
            .join("")
        : empty(
            "Nội dung đang được chuẩn bị",
            "Các bài học của khóa học sẽ xuất hiện tại đây.",
            canManage(course)
              ? button(
                  "Thêm bài học đầu tiên",
                  "create-lesson",
                  "primary",
                  `data-id="${course.id}"`,
                )
              : "",
          )
    }</div>`;
  } else if (tab === "students") {
    const students = await request(`/progress/courses/${course.id}/students`);
    state.students = students;
    body = `<div class="section-heading"><h2>${count(students.totalStudents)} sinh viên đồng hành</h2></div>${students.students.length ? `<div class="table-wrap"><table><thead><tr><th>Sinh viên</th><th>Ngày ghi danh</th><th>Tiến độ học tập</th><th>Trạng thái</th></tr></thead><tbody>${students.students.map((student) => `<tr><td><div class="cell-user">${avatar(student.studentName)}<div><strong>${esc(student.studentName)}</strong><small>${esc(student.studentEmail)}</small></div></div></td><td>${date(student.enrolledAt)}</td><td style="min-width:180px">${progressBar(student)}</td><td><span class="badge ${student.percentage === 100 && student.totalLessons > 0 ? "" : "neutral"}">${student.percentage === 100 && student.totalLessons > 0 ? "Hoàn thành" : "Đang học"}</span></td></tr>`).join("")}</tbody></table></div>` : empty("Chưa có sinh viên", "Các sinh viên ghi danh sẽ được hiển thị tại đây.")}`;
  } else {
    const files = await request(`/files/courses/${course.id}`);
    body = `<section class="panel"><div class="panel-heading"><div><h2>Ảnh bìa khóa học</h2><p class="text-muted text-small">JPG, PNG hoặc WebP · Tối đa 5 MB</p></div>${canManage(course) ? button(`${icon("upload")}Tải ảnh lên`, "upload-image", "secondary", `data-id="${course.id}"`) : ""}</div>${files.length ? `<div class="document-list">${files.map((file) => fileRow(file, canManage(course), canManage(course) || enrolled(course.id))).join("")}</div>` : '<p class="text-muted text-small">Chưa có ảnh bìa được tải lên.</p>'}</section><section class="panel"><h2>Tài liệu bài học</h2><p class="text-muted text-small">${canManage(course) ? "Mở từng bài học để tải lên và quản lý ảnh và tài liệu Word, PowerPoint, Excel, PDF." : "Mở bài học sau khi ghi danh để xem và tải các tài liệu được chia sẻ."}</p><a href="#/courses/${course.id}" class="btn btn-secondary btn-sm">Xem danh sách bài học</a></section>`;
  }
  return `<a class="back-link" href="#/courses">${icon("back")}Thư viện khóa học</a><section class="course-detail-header"><div><span class="badge">${esc(categoryName(course))}</span><h1>${esc(course.title)}</h1><p>${esc(course.description || "Nội dung giới thiệu đang được cập nhật.")}</p><div class="detail-meta"><span>${icon("user")}${esc(course.instructorName || "Chưa phân công giảng viên")}</span><span>${icon("users")}${esc(course.staffName || "Chưa phân công nhân viên")}</span><span>${icon("book")}${count(lessons.length)} bài học</span><span>${icon("clock")}${count(lessons.reduce((sum, item) => sum + item.durationMinutes, 0))} phút</span></div>${is("Admin") ? `<div class="detail-meta">${button(`${icon("user")}Phân công giảng viên`, "assign-instructor", "secondary", `data-id="${course.id}"`)}${button(`${icon("users")}Phân công nhân viên`, "assign-staff", "secondary", `data-id="${course.id}"`)}</div>` : ""}</div><aside>${cover(course, true)}<div class="detail-price-row"><span class="text-small text-muted">Học phí khóa học</span><span class="course-price ${Number(course.price) === 0 ? "free" : ""}">${money(course.price)}</span></div><div class="detail-actions">${actions}</div>${enrolled(course.id) ? '<p class="text-small" style="color:#648854;margin:12px 0 0">Bạn đã ghi danh khóa học này.</p>' : ""}</aside></section>${detailTabs(course, tab)}<section id="detail-tab-panel" role="tabpanel" aria-labelledby="tab-${tab}">${body}</section>`;
}
