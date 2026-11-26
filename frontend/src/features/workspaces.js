import { escapeHtml as esc } from "../api/client.js";
import { icon } from "../components/icons.js";
import { courseArtwork } from "../components/course-artwork.js";

const number = value => new Intl.NumberFormat("vi-VN").format(Number(value) || 0);
const amount = value => Number(value) ? new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value) : "Miễn phí";
export const WORKSPACES = {
  Admin: { key: "admin", name: "Quản trị hệ thống", short: "Quản trị", title: "Bảng điều hành", caption: "ADMIN CONSOLE", icon: "shield", note: "Một góc nhìn. Toàn hệ thống.", description: "Quản lý tài khoản, nội dung và hoạt động học tập.", link: "#/users", linkText: "Quản lý tài khoản" },
  User: { key: "student", name: "Không gian học tập", short: "Học tập", title: "Trang học tập", caption: "LEARNING SPACE", icon: "spark", note: "Đầu tư cho phiên bản tiếp theo.", description: "Tiếp tục hành trình và khám phá điều bạn yêu thích.", link: "#/my-courses", linkText: "Vào không gian học của tôi" },
  Staff: { key: "staff", name: "Không gian vận hành", short: "Vận hành", title: "Bảng công việc", caption: "OPERATIONS", icon: "layers", note: "Vận hành tốt. Học tập tốt hơn.", description: "Sắp xếp học liệu và đồng hành cùng sinh viên.", link: "#/my-courses", linkText: "Xem khóa phụ trách" },
  Instructor: { key: "instructor", name: "Phòng giảng dạy", short: "Giảng dạy", title: "Phòng giảng dạy", caption: "TEACHING STUDIO", icon: "graduation", note: "Kiến thức của bạn. Cảm hứng của ai đó.", description: "Xây dựng bài học và chăm sóc hành trình của học viên.", link: "#/enrollments", linkText: "Theo dõi học viên" },
};
const guest = { key: "guest", name: "Khám phá CourseFlow", short: "Khám phá", title: "Trang chủ", caption: "LEARN · BUILD · GROW", icon: "compass", note: "Bắt đầu từ một điều bạn tò mò.", description: "Khám phá khóa học và tìm hướng đi của bạn.", link: "#/courses", linkText: "Khám phá thư viện" };
export const workspaceFor = user => WORKSPACES[user?.role] || guest;
const action = (text, name, style = "primary") => `<button class="btn btn-${style}" data-action="${name}">${icon(name === "create-user" ? "users" : "plus")}${esc(text)}</button>`;
const link = (text, href, name = "next", style = "secondary") => `<a class="btn btn-${style}" href="${esc(href)}">${esc(text)}${icon(name)}</a>`;
const empty = text => `<div class="workspace-empty">${icon("book")}<p>${esc(text)}</p></div>`;
const panelTitle = (title, subtitle = "", href = "", more = "Xem tất cả") => `<div class="workspace-panel-heading"><div><h2>${esc(title)}</h2>${subtitle ? `<p>${esc(subtitle)}</p>` : ""}</div>${href ? `<a class="workspace-text-link" href="${esc(href)}">${esc(more)}${icon("next")}</a>` : ""}</div>`;

export function renderManagementCourses(courses, { lessons = [], canEdit = () => false, compact = false } = {}) {
  if (!courses.length) return empty("Chưa có khóa học phù hợp. Khóa học mới sẽ xuất hiện tại đây.");
  return `<div class="table-wrap workspace-course-table"><table><thead><tr><th>Khóa học</th><th>Giảng viên</th><th>Bài học</th>${compact ? "" : "<th>Học phí</th>"}<th class="workspace-align-right">Thao tác</th></tr></thead><tbody>${courses.map(course => {
    const lessonCount = lessons.filter(lesson => lesson.courseId === course.id).length;
    return `<tr><td><div class="workspace-course-cell"><img class="workspace-course-symbol" src="${courseArtwork(course, course.categoryName || "")}" alt="" width="64" height="48" loading="lazy" decoding="async" /><div><a href="#/courses/${Number(course.id)}"><strong>${esc(course.title)}</strong></a><small>${esc(course.categoryName || "Chưa phân loại")}</small></div></div></td><td>${course.instructorName ? `<span class="workspace-person">${icon("graduation")}${esc(course.instructorName)}</span>` : '<span class="workspace-status warning">Chưa phân công</span>'}</td><td><span class="workspace-status ${lessonCount ? "" : "neutral"}">${number(lessonCount)} bài học</span></td>${compact ? "" : `<td>${esc(amount(course.price))}</td>`}<td><div class="workspace-row-actions"><a class="icon-button" href="#/courses/${Number(course.id)}" aria-label="Mở ${esc(course.title)}" title="Chi tiết">${icon("next")}</a>${canEdit(course) ? `<button class="icon-button" data-action="edit-course" data-id="${Number(course.id)}" aria-label="Sửa ${esc(course.title)}" title="Sửa khóa học">${icon("edit")}</button>` : ""}</div></td></tr>`;
  }).join("")}</tbody></table></div>`;
}

function depthScene(workspace, courses, lessons) {
  const teaching = workspace.key === "instructor", operations = ["admin", "staff"].includes(workspace.key);
  return `<div class="depth-scene ${operations ? "operations-scene" : "learning-scene"}" aria-hidden="true"><div class="depth-orbit"></div><div class="depth-platform"></div><div class="depth-visual"><div class="depth-book depth-book-back"></div><div class="depth-book depth-book-main"><span class="depth-book-rule">COURSEFLOW</span><span class="depth-book-icon">${icon(teaching ? "graduation" : operations ? "layers" : "spark")}</span><strong>${teaching ? "Share.<br>Inspire." : operations ? "Manage.<br>Empower." : "Learn.<br>Become."}</strong><span class="depth-book-footer">${workspace.caption}</span></div><div class="depth-float depth-float-top">${icon(operations ? "book" : "check")}<span>${operations ? `${number(courses.length)} khóa học` : "Một bước tiến mới"}</span></div><div class="depth-float depth-float-bottom">${icon(teaching ? "play" : "layers")}<span>${number(lessons.length)} bài học</span></div><i class="depth-spark spark-one">✦</i><i class="depth-spark spark-two">✧</i></div></div>`;
}

function quickActions(role) {
  const items = role === "Admin" ? [
    ["Tạo khóa học", "Chuẩn bị nội dung mới", "book", "create-course"],
    ["Thêm tài khoản", "Cấp quyền đúng vai trò", "users", "create-user"],
    ["Đơn mua khóa học", "Theo dõi thanh toán", "shield", "#/purchases"],
    ["Lượt ghi danh", "Theo dõi hoạt động học", "chart", "#/enrollments"],
  ] : role === "Staff" ? [
    ["Khóa phụ trách", "Nội dung cần theo dõi", "book", "#/my-courses"],
    ["Sinh viên", "Tra cứu và hỗ trợ", "users", "#/users"],
    ["Lượt ghi danh", "Kiểm tra quyền học", "chart", "#/enrollments"],
    ["Danh mục", "Sắp xếp thư viện", "layers", "#/categories"],
  ] : [
    ["Khóa tôi giảng dạy", "Cập nhật bài học, tài liệu", "book", "#/my-courses"],
    ["Học viên của tôi", "Xem tiến độ từng người", "users", "#/enrollments"],
    ["Tạo khóa học", "Bắt đầu chia sẻ kiến thức", "plus", "create-course"],
    ["Tài khoản", "Thông tin giảng viên", "graduation", "#/profile"],
  ];
  return `<div class="workspace-quick-actions">${items.map(([title, description, symbol, destination]) => {
    const content = `<span class="workspace-action-icon">${icon(symbol)}</span><span><strong>${esc(title)}</strong><small>${esc(description)}</small></span>${icon("next")}`;
    return destination.startsWith("#") ? `<a href="${destination}" class="workspace-action">${content}</a>` : `<button class="workspace-action" data-action="${destination}">${content}</button>`;
  }).join("")}</div>`;
}

function distribution(counts) {
  const roles = [["Sinh viên", counts.students, "#5268e8"], ["Nhân viên", counts.staff, "#2aa797"], ["Giảng viên", counts.instructors, "#a17ae0"], ["Admin", counts.admins, "#e6ad60"]];
  const total = roles.reduce((sum, [, value]) => sum + (Number(value) || 0), 0);
  let start = 0;
  const stops = roles.map(([, value, color]) => { const end = start + (total ? (Number(value) || 0) / total * 100 : 0); const result = `${color} ${start}% ${end}%`; start = end; return result; });
  return `<div class="workspace-distribution"><div class="workspace-donut" style="--donut:${total ? `conic-gradient(${stops.join(",")})` : "#e9edf5"}"><div><strong>${number(total)}</strong><span>Tài khoản</span></div></div><div class="workspace-role-legend">${roles.map(([title, value, color]) => `<div><span><i style="background:${color}"></i>${title}</span><strong>${number(value)}</strong></div>`).join("")}</div></div>`;
}

function recentEnrollments(enrollments, date) {
  return enrollments.length ? `<div class="workspace-activity-list">${enrollments.slice(0, 5).map(item => `<a href="#/courses/${Number(item.courseId)}"><span class="workspace-activity-icon">${icon("users")}</span><span><strong>${esc(item.studentName)}</strong><small>${esc(item.courseName)}</small></span><time>${esc(date(item.enrolledAt))}</time></a>`).join("")}</div>` : empty("Chưa có lượt ghi danh. Hoạt động mới sẽ được cập nhật tại đây.");
}

export function renderWorkspaceDashboard(data, view) {
  const { user, courses, lessons, progress, enrollments, userCounts, roleError } = data;
  const workspace = workspaceFor(user), admin = user?.role === "Admin", student = user?.role === "User", member = student || !user;
  const own = user?.role === "Instructor" ? courses.filter(course => course.instructorId === user.id)
    : user?.role === "Staff" ? courses.filter(course => course.staffId === user.id) : courses;
  const missingTeacher = courses.filter(course => !course.instructorId).length;
  const noLessons = own.filter(course => !lessons.some(lesson => lesson.courseId === course.id)).length;
  const sceneLessons = member || admin ? lessons : lessons.filter(lesson => own.some(course => course.id === lesson.courseId));
  const firstName = user?.fullName?.trim().split(/\s+/).at(-1) || "bạn";
  const dateLabel = new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(new Date());
  const pageTitle = admin ? "Tổng quan hệ thống" : student ? `Chào ${firstName}, hôm nay học gì?` : user?.role === "Instructor" ? `Chào ${firstName}, cùng truyền cảm hứng.` : user?.role === "Staff" ? `Chào ${firstName}, sẵn sàng cho ngày mới.` : "Một kỹ năng mới. Một tương lai mới.";
  const heroTitle = admin ? "Mọi hoạt động.<br><em>Một góc nhìn rõ ràng.</em>" : student ? "Học điều bạn thích.<br><em>Trở thành điều bạn muốn.</em>" : user?.role === "Instructor" ? "Kiến thức của bạn.<br><em>Khởi đầu của học viên.</em>" : user?.role === "Staff" ? "Sắp xếp khoa học.<br><em>Vận hành nhẹ nhàng.</em>" : "Đầu tư cho bản thân.<br><em>Bắt đầu từ hôm nay.</em>";
  const heroText = admin ? "Theo dõi hoạt động, quản lý con người và phát triển thư viện khóa học trong một không gian thống nhất." : workspace.description;
  const heroButtons = admin ? action("Tạo khóa học", "create-course") + link("Quản lý tài khoản", "#/users")
    : member ? link(student && enrollments.length ? "Tiếp tục học" : "Khám phá khóa học", student && enrollments.length ? "#/my-courses" : "#/courses", "next", "primary") + (student ? link("Khám phá thư viện", "#/courses") : action("Tham gia CourseFlow", "register", "secondary"))
    : action("Tạo khóa học", "create-course") + link(workspace.linkText, workspace.link);
  let html = `<div class="workspace-dashboard"><div class="workspace-page-heading"><div><span class="workspace-kicker">${icon(workspace.icon)}${workspace.name}</span><h1>${esc(pageTitle)}</h1><p>${admin ? "Con người, nội dung và học tập — được kết nối." : "Không gian được chuẩn bị cho hành trình của bạn."}</p></div><span class="workspace-date">${icon("calendar")}${esc(dateLabel)}</span></div>${roleError ? `<div class="notice">Một phần dữ liệu chưa tải được: ${esc(roleError)}. Hãy làm mới để thử lại.</div>` : ""}
    <section class="workspace-hero" data-depth-root><div class="workspace-hero-copy"><span class="workspace-hero-label"><i></i>${admin ? "TRUNG TÂM ĐIỀU HÀNH" : user?.role === "Instructor" ? "KHÔNG GIAN SÁNG TẠO" : user?.role === "Staff" ? "CÙNG NHAU VẬN HÀNH" : "YOUR NEXT CHAPTER"}</span><h2>${heroTitle}</h2><p>${esc(heroText)}</p><div class="workspace-hero-actions">${heroButtons}</div>${member ? `<div class="workspace-hero-foot">${icon("book")}<span>${number(courses.length)} khóa học để bạn khám phá</span><span class="workspace-foot-dot"></span><span>Học theo nhịp của bạn</span></div>` : `<div class="workspace-hero-foot">${icon("shield")}<span>${admin ? "Quyền quản trị · Toàn hệ thống" : workspace.name}</span></div>`}</div>${depthScene(workspace, admin ? courses : own, sceneLessons)}</section>
    <div class="stats-grid${admin ? " admin-stats" : ""}">${view.statsMarkup}</div>`;
  if (admin) {
    html += `<div class="workspace-admin-grid"><section class="workspace-panel workspace-course-overview">${panelTitle("Thư viện cần bạn quản lý", "Nội dung và phân công trong từng khóa học.", "#/courses", "Quản lý thư viện")}${renderManagementCourses(courses.slice(0, 5), { lessons, canEdit: () => true, compact: true })}<div class="workspace-panel-foot"><span>${icon("book")}${number(courses.length)} khóa học trong hệ thống</span><a href="#/courses">Xem danh sách${icon("next")}</a></div></section><section class="workspace-panel">${panelTitle("Tác vụ nhanh", "Đi thẳng đến việc cần làm.")}${quickActions("Admin")}</section><section class="workspace-panel workspace-chart-panel">${panelTitle("Hoạt động học tập", "Ghi danh trong sáu tháng gần đây.")}${view.chartMarkup}</section><section class="workspace-panel">${panelTitle("Cộng đồng CourseFlow", "Phân bố tài khoản theo vai trò.")}${distribution(userCounts)}</section><section class="workspace-panel">${panelTitle("Ghi danh gần đây", "Những hành trình vừa bắt đầu.", "#/enrollments")}${recentEnrollments(enrollments, view.date)}</section><section class="workspace-panel workspace-attention">${panelTitle("Điểm cần theo dõi", "Chuẩn bị một trải nghiệm học đầy đủ.")}<a href="#/courses"><span class="workspace-attention-icon">${icon("graduation")}</span><span><strong>${number(missingTeacher)} khóa chưa có giảng viên</strong><small>Kiểm tra và phân công người giảng dạy.</small></span>${icon("next")}</a><a href="#/courses"><span class="workspace-attention-icon">${icon("layers")}</span><span><strong>${number(noLessons)} khóa chưa có bài học</strong><small>Bổ sung nội dung cho thư viện.</small></span>${icon("next")}</a></section></div>`;
  } else if (member) {
    const enrolled = courses.filter(course => enrollments.some(item => item.courseId === course.id));
    const resume = enrolled.find(course => (progress.find(item => item.courseId === course.id)?.percentage || 0) < 100) || enrolled[0];
    const progressItem = resume && progress.find(item => item.courseId === resume.id);
    html += `<div class="workspace-learning-grid"><div><section class="workspace-featured"><div class="workspace-panel-heading"><div><span class="workspace-kicker">${icon(student && resume ? "play" : "compass")}${student && resume ? "ĐANG HỌC" : "DÀNH CHO BẠN"}</span><h2>${esc(view.sectionTitle)}</h2><p>Thêm kiến thức. Mở thêm những lựa chọn.</p></div><a class="workspace-text-link" href="#/${student && resume ? "my-courses" : "courses"}">Xem tất cả${icon("next")}</a></div><div class="course-grid compact">${view.featuredMarkup}</div></section><section class="workspace-panel workspace-discover-banner"><div><span class="workspace-kicker">${icon("spark")}TIẾP TỤC KHÁM PHÁ</span><h2>Điều mới mẻ tiếp theo đang chờ bạn.</h2><p>Chọn một lĩnh vực yêu thích và bắt đầu theo cách của mình.</p></div>${link("Tìm khóa học", "#/courses", "compass", "primary")}</section></div><aside class="workspace-learning-aside">${resume ? `<section class="workspace-panel workspace-resume"><span class="workspace-kicker">${icon("play")}HÀNH TRÌNH CỦA BẠN</span><div class="workspace-resume-icon">${icon("book")}</div><h2>${esc(resume.title)}</h2><p>Mỗi bài học hoàn thành là một bước tiến.</p>${progressItem ? view.progressBar(progressItem) : ""}${link("Vào học", `#/courses/${Number(resume.id)}`, "next", "primary")}</section>` : `<section class="workspace-panel workspace-resume"><span class="workspace-kicker">${icon("target")}MỤC TIÊU MỚI</span><div class="workspace-resume-icon">${icon("spark")}</div><h2>Khởi đầu bằng một điều bạn tò mò.</h2><p>Khám phá khóa học phù hợp với mục tiêu của bạn.</p>${link("Khám phá ngay", "#/courses", "next", "primary")}</section>`}<section class="workspace-panel">${panelTitle("Lĩnh vực bạn có thể thích", "Mở rộng thế giới của mình.")}${view.categoryMarkup || empty("Danh mục đang được chuẩn bị.")}</section></aside></div>`;
  } else {
    html += `<div class="workspace-workbench"><section class="workspace-panel workspace-work-list">${panelTitle(user.role === "Instructor" ? "Bàn làm việc giảng dạy" : "Khóa học đang phụ trách", "Nội dung của bạn, sẵn sàng để tiếp tục.", "#/my-courses")}${renderManagementCourses(own.slice(0, 6), { lessons, canEdit: () => true })}</section><aside><section class="workspace-panel">${panelTitle("Lối tắt công việc", "Những việc bạn dùng mỗi ngày.")}${quickActions(user.role)}</section><section class="workspace-panel workspace-work-note"><span class="workspace-kicker">${icon("spark")}GÓC CÔNG VIỆC</span><h2>${noLessons ? `${number(noLessons)} khóa cần thêm bài học` : "Sẵn sàng cho bước tiếp theo."}</h2><p>${noLessons ? "Bổ sung nội dung và đính kèm học liệu để học viên bắt đầu." : "Mở một khóa học để cập nhật nội dung hoặc theo dõi học viên."}</p>${link("Mở khóa học của tôi", "#/my-courses")}</section></aside></div>`;
  }
  return html + "</div>";
}

export function installWorkspaceEffects() {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  let frame = 0, root = null, point = null;
  document.addEventListener("pointermove", event => {
    if (reduced.matches || event.pointerType === "touch") return;
    const target = event.target.closest?.("[data-depth-root]");
    if (!target) return;
    root = target; point = { x: event.clientX, y: event.clientY };
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!root?.isConnected || !point) return;
      const rect = root.getBoundingClientRect();
      root.style.setProperty("--depth-x", `${(point.x - rect.left - rect.width / 2) / rect.width * 8}deg`);
      root.style.setProperty("--depth-y", `${(point.y - rect.top - rect.height / 2) / rect.height * -6}deg`);
    });
  }, { passive: true });
  document.addEventListener("pointerout", event => {
    const target = event.target.closest?.("[data-depth-root]");
    if (target && !target.contains(event.relatedTarget)) {
      target.style.setProperty("--depth-x", "0deg"); target.style.setProperty("--depth-y", "0deg");
    }
  }, { passive: true });
}
