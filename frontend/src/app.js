import {
  request,
  getToken,
  setToken,
  query,
  escapeHtml as esc,
  safeUrl,
} from "./api/client.js";

import { icon } from "./components/icons.js";
import { API_DOCS_URL } from "./config.js";
import { purchaseDetail, purchaseList, printPurchase } from "./features/purchases.js";
import {
  ROLE_NAMES as roleName,
  ROLE_DEFINITIONS,
  hasPermission,
  canManageCatalog,
  canCreateCourse,
  canManageCourse,
  canResetPassword,
  directoryRoles,
  canAccessPage,
} from "./auth/permissions.js";
const $ = (selector, root = document) => root.querySelector(selector);
const main = $("#main-content");
const dialog = $("#app-dialog");
const count = (number) => new Intl.NumberFormat("vi-VN").format(number || 0);
const money = (value) =>
  Number(value) === 0
    ? "Miễn phí"
    : new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(value || 0);
const date = (value) =>
  value
    ? new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date(/Z$|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`))
    : "—";
const initials = (value) =>
  String(value || "Khách")
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
const avatar = (name, extra = "") =>
  `<span class="avatar ${extra}" aria-hidden="true">${esc(initials(name))}</span>`;
const state = {
  user: null,
  courses: [],
  categories: [],
  lessons: [],
  enrollments: [],
  progress: [],
  userCounts: {},
  ready: false,
  roleError: null,
  courseDetail: null,
  lessonDetail: null,
  students: null,
  users: null,
};
let renderVersion = 0;
let modalSubmit = null;
let loadingPromise = null;
let pendingRoute = null;
let pendingTabFocus = null;
let sessionTimer;
let purchasePollTimer;
const is = (role) => state.user?.role === role;
const canCreate = () => canCreateCourse(state.user);
const canManage = (course) => canManageCourse(state.user, course);
const enrolled = (courseId) =>
  is("User") && state.enrollments.some((item) => item.courseId === courseId);
const lessonsFor = (id) => state.lessons.filter((item) => item.courseId === id);
const progressFor = (id) => state.progress.find((item) => item.courseId === id);
const categoryName = (course) =>
  course.categoryName ||
  state.categories.find((item) => item.id === course.categoryId)?.name ||
  "Chưa phân loại";
const button = (label, action, style = "primary", extra = "") =>
  `<button class="btn btn-${style}" data-action="${action}" ${extra}>${label}</button>`;
const linkButton = (label, href, style = "secondary") =>
  `<a class="btn btn-${style}" href="${esc(href)}" ${label === icon("play") ? 'aria-label="Mở bài học"' : ""}>${label}</a>`;
const toolsButton = (name, action, id, label, extra = "") =>
  `<button class="icon-button ${name === "trash" ? "danger" : ""}" data-action="${action}" data-id="${id}" title="${esc(label)}" aria-label="${esc(label)}" ${extra}>${icon(name)}</button>`;
const errorBox = (message) =>
  `<div class="error-panel">${icon("alert")}<h2>Chưa thể tải dữ liệu</h2><p>${esc(message)}</p>${button(`${icon("refresh")}Thử lại`, "refresh", "secondary")}</div>`;
const empty = (title, description, action = "") =>
  `<div class="empty-state">${icon("book")}<h3>${esc(title)}</h3><p>${esc(description)}</p>${action}</div>`;
function hydrateIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((node) => {
    node.innerHTML = icon(node.dataset.icon);
    node.removeAttribute("data-icon");
  });
}
function toast(message, error = false) {
  const node = document.createElement("div");
  node.className = `toast${error ? " error" : ""}`;
  node.innerHTML = `${icon(error ? "alert" : "check")}<span>${esc(message)}</span><button aria-label="Đóng thông báo">×</button>`;
  node.querySelector("button").onclick = () => node.remove();
  $("#toast-region").append(node);
  setTimeout(() => node.remove(), error ? 8000 : 5000);
}
function currentRoute() {
  const [path, search = ""] = location.hash.replace(/^#\/?/, "").split("?");
  const [page = "dashboard", id, sub] = (path || "dashboard").split("/");
  return { page, id: Number(id), sub, params: new URLSearchParams(search) };
}
function navigate(path) {
  if (location.hash === `#/${path}`) {
    state.ready = false;
    void render();
  }
  else location.hash = `/${path}`;
}
function heading(title, description, actions = "") {
  return `<div class="page-heading"><div><h1>${esc(title)}</h1><p>${esc(description)}</p></div>${actions ? `<div class="page-actions">${actions}</div>` : ""}</div>`;
}
function setMenu(open) {
  $("#sidebar").classList.toggle("open", open);
  $(".sidebar-scrim").hidden = !open;
  $('[data-action="toggle-menu"]').setAttribute("aria-expanded", String(open));
}
function shell(page) {
  const routes = [
    ["dashboard", "grid", "Tổng quan"],
    ["courses", "compass", "Khám phá"],
  ];
  if (!is("Admin"))
    routes.push([
      "my-courses",
      "book",
      is("Staff") ? "Khóa phụ trách" : is("Instructor") ? "Khóa tôi giảng dạy" : "Khóa học của tôi",
    ]);
  if (is("User")) routes.push(["progress", "chart", "Tiến độ học tập"]);
  if (is("User") || is("Admin")) routes.push(["purchases", "book", is("Admin") ? "Đơn mua khóa học" : "Đơn mua & hóa đơn"]);
  routes.push(["categories", "layers", "Danh mục"]);
  const management = canManageCatalog(state.user)
    ? [
        ["users", "users", is("Admin") ? "Tài khoản" : "Sinh viên"],
        ["enrollments", "chart", "Lượt ghi danh"],
      ]
    : is("Instructor") ? [["enrollments", "chart", "Học viên của tôi"]] : [];
  if (state.user) management.push(["permissions", "shield", "Vai trò & quyền"]);
  const activePage = page === "lesson" ? "courses" : page;
  const navLink = ([route, name, title]) =>
    `<a href="#/${route}" class="nav-link${activePage === route ? " active" : ""}" ${activePage === route ? 'aria-current="page"' : ""}>${icon(name)}<span>${title}</span>${route === "courses" && state.ready ? `<span class="nav-count">${count(state.courses.length)}</span>` : ""}</a>`;
  $("#primary-nav").innerHTML =
    routes.map(navLink).join("") +
    (management.length
      ? '<div class="nav-section">QUẢN LÝ & TÀI KHOẢN</div>' +
        management.map(navLink).join("")
      : "");
  $("#breadcrumb").textContent =
    [...routes, ...management].find((item) => item[0] === activePage)?.[2] ||
    (page === "profile" ? "Tài khoản" : "Khóa học");
  $("#sidebar-account").innerHTML = state.user
    ? `<div class="sidebar-account">${avatar(state.user.fullName, "sidebar-avatar")}<a href="#/profile"><strong>${esc(state.user.fullName)}</strong><small>${roleName[state.user.role]}</small></a>${toolsButton("logout", "logout", 0, "Đăng xuất")}</div>`
    : `<div class="sidebar-account">${avatar("Khách", "sidebar-avatar")}<div><strong>Xin chào, bạn!</strong><small>Khám phá cùng CourseFlow</small></div></div>`;
  $("#topbar-account").innerHTML = state.user
    ? `<a href="#/profile" class="topbar-user" aria-label="Tài khoản ${esc(state.user.fullName)}">${avatar(state.user.fullName)}<span class="user-label"><strong>${esc(state.user.fullName.split(" ").slice(-2).join(" "))}</strong><small>${roleName[state.user.role]}</small></span></a>`
    : button("Đăng nhập", "login", "primary");
  hydrateIcons();
}
async function loadData() {
  if (loadingPromise) {
    await loadingPromise;
    // A sign-in or sign-out may have occurred while the previous request ran.
    if (state.ready) return;
    return loadData();
  }
  const tokenAtStart = getToken();
  loadingPromise = (async () => {
    const [courses, categories, lessons, profile] = await Promise.all([
      request("/courses"),
      request("/categories"),
      request("/lessons"),
      state.user && tokenAtStart
        ? request("/auth/me").catch((error) => {
            if (error.status === 401) return null;
            throw error;
          })
        : Promise.resolve(null),
    ]);
    state.courses = courses;
    state.categories = categories;
    state.lessons = lessons;
    state.enrollments = [];
    state.progress = [];
    state.userCounts = {};
    state.roleError = null;
    if (profile && getToken() === tokenAtStart) state.user = profile;
    if (state.user && getToken() === tokenAtStart) {
      try {
        if (is("User"))
          [state.enrollments, state.progress] = await Promise.all([
            request("/enrollments/my"),
            request("/progress/my"),
          ]);
        if (canManageCatalog(state.user)) {
          const [enrollments, students] = await Promise.all([
            request("/enrollments"),
            request("/users?Role=User&PageSize=1"),
          ]);
          state.enrollments = enrollments;
          state.userCounts = { students: students.totalCount };
          if (is("Admin")) {
            const staff = await request("/users?Role=Staff&PageSize=1");
            state.userCounts.staff = staff.totalCount;
          }
        }
      } catch (error) {
        state.roleError = error.message;
      }
    }
    if (getToken() !== tokenAtStart) {
      state.enrollments = [];
      state.progress = [];
      state.userCounts = {};
    }
    state.ready = getToken() === tokenAtStart;
  })().finally(() => {
    loadingPromise = null;
  });
  await loadingPromise;
  if (!state.ready) return loadData();
}
function cover(course, full = false) {
  const theme = Math.abs((course.categoryId || course.id) - 1) % 5;
  const drawings = [
    '<rect x="26" y="30" width="130" height="87" rx="6" fill="currentColor" fill-opacity=".08"/><rect x="19" y="22" width="130" height="87" rx="6" fill="white" fill-opacity=".6"/><path d="M19 41h130M28 31h2m5 0h2m5 0h2m22 25-15 13 15 13m37-26 15 13-15 13m-14-31-9 37M7 117h154"/><rect x="117" y="81" width="48" height="45" rx="6" fill="currentColor" stroke="none"/><path d="m132 103 6 6 12-14" stroke="white"/><path d="m165 23 3 9 9 3-9 3-3 9-3-9-9-3 9-3Z" fill="currentColor" fill-opacity=".2"/>',
    '<rect x="32" y="22" width="100" height="100" rx="8" transform="rotate(-8 82 72)" fill="white" fill-opacity=".5"/><rect x="53" y="16" width="100" height="100" rx="8" fill="white" fill-opacity=".8"/><circle cx="82" cy="45" r="12" fill="currentColor" fill-opacity=".16"/><path d="m63 87 25-24 18 14 13-10 22 20M65 98h39"/><rect x="125" y="84" width="42" height="42" rx="8" fill="currentColor"/><path d="m136 104 8-8 10 8-10 10Z" stroke="white"/><circle cx="25" cy="45" r="8" fill="currentColor" fill-opacity=".16"/>',
    '<path d="M36 115V50l40-20 40 20v65Z" fill="white" fill-opacity=".65"/><path d="m36 50 40 22 40-22M76 72v43M36 93l40 22 40-22"/><rect x="94" y="58" width="64" height="64" rx="7" fill="currentColor" fill-opacity=".85"/><path d="M106 104h12V90h14V76h14M106 104l40-28" stroke="white"/><circle cx="138" cy="27" r="12" fill="currentColor" fill-opacity=".12"/><path d="M20 111h144M20 32h12m-6-6v12"/>',
    '<circle cx="88" cy="69" r="47" fill="white" fill-opacity=".5"/><ellipse cx="88" cy="69" rx="22" ry="47"/><path d="M41 69h94M48 44h80M48 94h80M88 22v94"/><rect x="121" y="76" width="45" height="45" rx="8" fill="currentColor"/><path d="m135 98 7 7 12-16" stroke="white"/><circle cx="27" cy="35" r="7" fill="currentColor" fill-opacity=".15"/>',
    '<path d="M40 110V33l44-9v86Zm44 0V24l44 9v77" fill="white" fill-opacity=".7"/><path d="M84 24v86M48 43l26-5m-26 20 26-5m-26 20 26-5m-26 20 26-5m20-45 24 5m-24 10 24 5m-24 10 24 5"/><rect x="112" y="79" width="48" height="43" rx="8" fill="currentColor"/><path d="m127 100 7 7 13-15" stroke="white"/><path d="m143 23 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" fill="currentColor" fill-opacity=".2"/>',
  ];
  return `<div class="course-cover" data-theme="${theme}" ${full ? "" : 'aria-hidden="true"'}><svg viewBox="0 0 180 145" aria-hidden="true">${drawings[theme]}</svg><span class="cover-category">${esc(categoryName(course))}</span><span class="cover-index">COURSEFLOW / LEARNING</span></div>`;
}
function courseCard(course, showProgress = false) {
  const lessons = lessonsFor(course.id),
    totalMinutes = lessons.reduce((sum, item) => sum + item.durationMinutes, 0),
    progress = progressFor(course.id);
  return `<article class="course-card"><a href="#/courses/${course.id}" tabindex="-1" aria-hidden="true">${cover(course)}</a><div class="course-card-body"><div class="course-category"><span class="category-dot"></span>${esc(categoryName(course))}</div><h3><a href="#/courses/${course.id}">${esc(course.title)}</a></h3><p class="course-description">${esc(course.description || "Khám phá kiến thức mới và phát triển kỹ năng qua từng bài học.")}</p><div class="course-instructor">${icon("user")}${esc(course.instructorName || "Chưa phân công giảng viên")}</div><div class="course-meta"><span>${icon("book")}${count(lessons.length)} bài học</span><span>${icon("clock")}${count(totalMinutes)} phút</span></div>${showProgress && progress ? progressBar(progress) : ""}<div class="course-card-footer"><span class="course-price ${Number(course.price) === 0 ? "free" : ""}">${money(course.price)}</span><a class="course-open" href="#/courses/${course.id}">${enrolled(course.id) ? "Vào học" : canManage(course) ? "Quản lý" : "Xem khóa học"}</a></div></div></article>`;
}
function progressBar(item) {
  return `<div class="progress-block"><div class="progress-caption"><span>${count(item.completedLessons)}/${count(item.totalLessons)} bài học</span><strong>${count(item.percentage)}%</strong></div><div class="progress-track" role="progressbar" aria-label="Tiến độ học tập" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Number(item.percentage) || 0}"><div class="progress-fill" style="width:${Math.min(100, Math.max(0, Number(item.percentage) || 0))}%"></div></div></div>`;
}
function statCard(label, value, name, note) {
  return `<article class="stat-card"><div class="stat-top"><span class="stat-label">${esc(label)}</span><span class="stat-icon">${icon(name)}</span></div><div class="stat-value">${esc(value)}</div><div class="stat-note">${icon("check")}${esc(note)}</div></article>`;
}
function heroArt() {
  return `<div class="hero-art" aria-hidden="true"><svg viewBox="0 0 350 235"><circle cx="187" cy="117" r="91" stroke="#5c7f5b" stroke-dasharray="3 8"/><circle cx="187" cy="117" r="66" stroke="#5c7f5b" stroke-opacity=".4"/><path d="m88 161 90-32 87 27-89 34Z" fill="#bad27d" stroke="#bad27d"/><path d="m88 161 1 15 87 29 88-34 1-15M176 190v15" stroke="#719451" fill="#a8c366"/><path d="m105 130 91-31 76 24-91 34Z" fill="#eaf0d8" stroke="#eaf0d8"/><path d="M105 130v15l76 25 90-32 1-15m-91 34v13" fill="#cfdbb6" stroke="#9fb28b"/><path d="m112 100 77-28 77 24-79 30Z" fill="#d2f58a" stroke="#d2f58a"/><path d="m112 100 1 15 74 26 79-30V96m-79 30v15" fill="#a8cd6b" stroke="#81a64e"/><path d="m169 50 37-12 35 12-37 14Z" fill="#e8f2db" stroke="#e8f2db"/><path d="m180 55 1 16s23 15 46-1V55m14-5v21" stroke="#c7deac"/><circle cx="77" cy="76" r="18" fill="#d2f58a" stroke="none"/><path d="m70 76 5 5 10-12" stroke="#284b31" stroke-width="2.5"/><path d="m277 45 3 11 11 3-11 3-3 11-3-11-11-3 11-3Z" fill="#d2f58a" stroke="none"/><circle cx="291" cy="146" r="6" fill="#b3cd92" stroke="none"/><path d="m60 181 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" fill="#8ba66f" stroke="none"/></svg></div>`;
}
function activityChart() {
  const now = new Date(),
    months = Array.from(
      { length: 6 },
      (_, index) => new Date(now.getFullYear(), now.getMonth() - 5 + index, 1),
    );
  const data = is("Admin") ? state.enrollments : state.courses;
  const values = months.map(
    (month) =>
      data.filter((item) => {
        const d = new Date(item.enrolledAt || item.createdAt);
        return (
          d.getMonth() === month.getMonth() &&
          d.getFullYear() === month.getFullYear()
        );
      }).length,
  );
  const max = Math.max(...values, 1);
  return `<section class="side-panel"><h2>${is("Admin") ? "Hoạt động ghi danh" : "Thư viện đang phát triển"}</h2><p>Trong 6 tháng gần đây</p><div class="chart-bars" role="img" aria-label="${esc(months.map((month, index) => `Tháng ${month.getMonth() + 1}: ${values[index]}`).join("; "))}">${values.map((value) => `<div class="chart-column"><b>${count(value)}</b><div class="chart-bar" style="height:${Math.max(3, (value / max) * 86)}px"></div></div>`).join("")}</div><div class="chart-months">${months.map((month) => `<span>Th.${month.getMonth() + 1}</span>`).join("")}</div><div class="chart-legend"><i></i>${is("Admin") ? "Lượt đăng ký khóa học" : "Khóa học mới"}</div></section>`;
}
function dashboard() {
  const name = state.user?.fullName?.split(" ").at(-1);
  const title = name
    ? `Chào ${name}, ngày mới tốt lành!`
    : "Hành trình mới, bắt đầu từ đây.";
  let stats,
    heroTitle,
    heroText,
    heroAction,
    featured = state.courses.slice(0, 4),
    sectionTitle = "Khóa học dành cho bạn";
  if (is("Admin")) {
    stats = [
      [
        "Tổng khóa học",
        count(state.courses.length),
        "book",
        "Trong thư viện của bạn",
      ],
      [
        "Sinh viên",
        count(state.userCounts.students),
        "users",
        "Tài khoản sinh viên",
      ],
      [
        "Nhân viên",
        count(state.userCounts.staff),
        "user",
        "Đồng hành cùng sinh viên",
      ],
      [
        "Lượt ghi danh",
        count(state.enrollments.length),
        "chart",
        "Trên toàn hệ thống",
      ],
    ];
    heroTitle = "Kiến tạo tri thức.<br /><em>Kết nối những tiềm năng.</em>";
    heroText =
      "Quản lý nội dung, đồng hành cùng nhân viên và mở ra những cơ hội học tập mới.";
    heroAction = button(
      `${icon("plus")}Tạo khóa học mới`,
      "create-course",
      "lime",
    );
    sectionTitle = "Khóa học mới nhất";
  } else if (is("Staff")) {
    const own = state.courses.filter(
        (course) => course.staffId === state.user.id,
      ),
      ownLessons = state.lessons.filter((item) =>
        own.some((course) => course.id === item.courseId),
      );
    stats = [
      [
        "Khóa học phụ trách",
        count(own.length),
        "book",
        "Nội dung do bạn quản lý",
      ],
      [
        "Bài học",
        count(ownLessons.length),
        "layers",
        "Đã sẵn sàng cho sinh viên",
      ],
      [
        "Thời lượng",
        `${count(ownLessons.reduce((sum, item) => sum + item.durationMinutes, 0))} phút`,
        "clock",
        "Tổng thời lượng bài học",
      ],
      [
        "Danh mục phụ trách",
        count(new Set(own.map((course) => course.categoryId)).size),
        "compass",
        "Lĩnh vực của bạn",
      ],
    ];
    heroTitle = "Vận hành hiệu quả.<br /><em>Đồng hành cùng sinh viên.</em>";
    heroText =
      "Tạo bài học, quản lý học liệu và theo dõi sự tiến bộ của sinh viên trong một không gian.";
    heroAction = button(
      `${icon("plus")}Tạo khóa học mới`,
      "create-course",
      "lime",
    );
    featured = (own.length ? own : state.courses).slice(0, 4);
    sectionTitle = own.length ? "Khóa học bạn phụ trách" : "Khóa học mới nhất";
  } else if (is("Instructor")) {
    const own = state.courses.filter((course) => canManage(course));
    const ownLessons = state.lessons.filter((lesson) => own.some((course) => course.id === lesson.courseId));
    stats = [
      ["Khóa đang giảng dạy", count(own.length), "book", "Được phân công cho bạn"],
      ["Bài học", count(ownLessons.length), "layers", "Nội dung trong khóa của bạn"],
      ["Thời lượng", `${count(ownLessons.reduce((sum, item) => sum + item.durationMinutes, 0))} phút`, "clock", "Tổng thời lượng bài học"],
      ["Lĩnh vực giảng dạy", count(new Set(own.map((course) => course.categoryId)).size), "compass", "Kiến thức bạn chia sẻ"],
    ];
    heroTitle = "Chia sẻ kiến thức.<br /><em>Đồng hành cùng học viên.</em>";
    heroText = "Xây dựng bài học, cập nhật học liệu và theo dõi tiến độ trong các khóa bạn giảng dạy.";
    heroAction = button(`${icon("plus")}Tạo khóa học`, "create-course", "lime");
    featured = own.slice(0, 4);
    sectionTitle = "Khóa học bạn giảng dạy";
  } else if (is("User")) {
    const total = state.progress.reduce(
        (sum, item) => sum + item.totalLessons,
        0,
      ),
      completed = state.progress.reduce(
        (sum, item) => sum + item.completedLessons,
        0,
      );
    stats = [
      [
        "Khóa học đã đăng ký",
        count(state.enrollments.length),
        "book",
        "Trong hành trình học tập",
      ],
      [
        "Bài học hoàn thành",
        count(completed),
        "check",
        `Trong tổng ${count(total)} bài học`,
      ],
      [
        "Khóa học hoàn thành",
        count(
          state.progress.filter(
            (item) => item.totalLessons > 0 && item.percentage === 100,
          ).length,
        ),
        "target",
        "Những cột mốc đáng nhớ",
      ],
      [
        "Tiến độ tổng thể",
        `${total ? Math.round((completed / total) * 100) : 0}%`,
        "chart",
        "Tính theo bài học hoàn thành",
      ],
    ];
    heroTitle =
      "Một chút nỗ lực mỗi ngày.<br /><em>Một phiên bản tốt hơn.</em>";
    heroText =
      "Tiếp tục bài học còn dang dở, khám phá kỹ năng mới và chinh phục mục tiêu của bạn.";
    heroAction = linkButton(
      `${icon("play")}Tiếp tục học`,
      "#/my-courses",
      "lime",
    );
    if (state.enrollments.length) {
      featured = state.courses
        .filter((course) => enrolled(course.id))
        .slice(0, 4);
      sectionTitle = "Tiếp tục hành trình của bạn";
    }
  } else {
    stats = [
      ["Khóa học", count(state.courses.length), "book", "Sẵn sàng để khám phá"],
      [
        "Danh mục",
        count(state.categories.length),
        "layers",
        "Đa dạng lĩnh vực học tập",
      ],
      [
        "Bài học",
        count(state.lessons.length),
        "play",
        "Kiến thức trong từng bước nhỏ",
      ],
      [
        "Khóa học miễn phí",
        count(state.courses.filter((item) => Number(item.price) === 0).length),
        "spark",
        "Bắt đầu theo cách của bạn",
      ],
    ];
    heroTitle = "Học điều mới.<br /><em>Mở lối tương lai.</em>";
    heroText =
      "Khám phá kiến thức, phát triển kỹ năng và biến những mục tiêu của bạn thành bước tiến thực tế.";
    heroAction = linkButton(
      `${icon("compass")}Khám phá khóa học`,
      "#/courses",
      "lime",
    );
  }
  const categoryRows = state.categories
    .slice(0, 4)
    .map(
      (item) =>
        `<a class="category-row" href="#/courses?category=${item.id}"><span class="category-icon">${icon("layers")}</span><span><span class="category-name">${esc(item.name)}</span><small>${count(state.courses.filter((course) => course.categoryId === item.id).length)} khóa học</small></span><span class="category-number">${icon("next")}</span></a>`,
    )
    .join("");
  const activities = is("Admin")
    ? state.enrollments.slice(0, 4)
    : state.courses.slice(0, 3);
  return (
    heading(
      title,
      "Tất cả những gì bạn cần cho một ngày học tập hiệu quả.",
      `<span class="date-label">${icon("calendar")}${new Intl.DateTimeFormat("vi-VN", { weekday: "short", day: "2-digit", month: "long", year: "numeric" }).format(new Date())}</span>`,
    ) +
    (state.roleError
      ? `<div class="notice">Một phần dữ liệu chưa tải được: ${esc(state.roleError)}. Hãy làm mới để thử lại.</div>`
      : "") +
    `<section class="hero"><div class="hero-copy"><div class="eyebrow">${icon("spark")}KHÔNG NGỪNG HỌC HỎI</div><h2>${heroTitle}</h2><p>${heroText}</p>${heroAction}</div>${heroArt()}<div class="hero-badge">${icon("shield")}Tri thức cho hành trình dài</div></section><div class="stats-grid">${stats.map((item) => statCard(...item)).join("")}</div><div class="dashboard-columns"><div><section><div class="section-heading"><div><h2>${sectionTitle}</h2><p>Kiến thức thực tế. Kỹ năng cho ngày mai.</p></div><a href="#/${is("Staff") || is("Instructor") || is("User") ? "my-courses" : "courses"}">Xem tất cả</a></div><div class="course-grid compact">${featured.length ? featured.map((course) => courseCard(course, is("User"))).join("") : empty("Một hành trình đang chờ bắt đầu", canCreate() ? "Tạo khóa học đầu tiên và chia sẻ kiến thức của bạn." : "Khám phá thư viện và chọn điều bạn muốn học.", canCreate() ? button("Tạo khóa học", "create-course") : linkButton("Khám phá khóa học", "#/courses", "primary"))}</div></section><section class="activity-panel"><div class="section-heading"><h2>${is("Admin") ? "Ghi danh gần đây" : "Mới trên CourseFlow"}</h2><span class="badge neutral">${is("Admin") ? "Ghi danh" : "Khóa học"}</span></div>${activities.length ? activities.map((item) => `<div class="activity-row"><span class="activity-icon">${icon(is("Admin") ? "users" : "book")}</span><div class="activity-main"><strong>${esc(is("Admin") ? item.studentName : item.title)}</strong><p>${esc(is("Admin") ? `Đã đăng ký ${item.courseName}` : categoryName(item))}</p></div><time>${date(item.enrolledAt || item.createdAt)}</time><a class="icon-button" href="#/courses/${item.courseId || item.id}" aria-label="Xem khóa học">${icon("next")}</a></div>`).join("") : '<p class="text-muted text-small">Chưa có hoạt động nào. Những bước tiến đầu tiên sẽ xuất hiện tại đây.</p>'}</section></div><aside class="dashboard-aside"><section class="side-panel"><div class="section-heading"><h2>Khám phá lĩnh vực</h2>${icon("compass")}</div>${categoryRows || "<p>Chưa có danh mục.</p>"}<a class="btn btn-secondary btn-sm full-width" href="#/categories">Tất cả danh mục</a></section>${activityChart()}<section class="tip-panel"><span class="eyebrow">GÓC CẢM HỨNG</span><h3>Đầu tư cho bản thân,<br />không bao giờ là muộn.</h3><p>Bắt đầu với một khóa học phù hợp. Kiên trì với từng bước nhỏ.</p><a class="btn" href="#/courses">Tìm điều bạn muốn học</a></section></aside></div>`
  );
}
function coursesPage(route, mine = false, progressOnly = false) {
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
      : "Khám phá khóa học";
  const subtitle = progressOnly
    ? "Mỗi bài học hoàn thành là một bước gần hơn với mục tiêu."
    : mine
      ? "Một nơi cho tất cả những bước tiến của bạn."
      : "Tìm kiến thức bạn cần. Xây dựng kỹ năng bạn muốn.";
  return (
    heading(
      title,
      subtitle,
      canCreate() ? button(`${icon("plus")}Tạo khóa học`, "create-course") : "",
    ) +
    `<form id="course-filter" class="toolbar" role="search"><div class="search-field">${icon("search")}<input type="search" name="search" value="${esc(search)}" placeholder="Tên khóa học, giảng viên…" aria-label="Tìm khóa học" maxlength="200" /></div><select name="category" aria-label="Lọc theo danh mục"><option value="">Tất cả danh mục</option>${state.categories.map((item) => `<option value="${item.id}" ${category === String(item.id) ? "selected" : ""}>${esc(item.name)}</option>`).join("")}</select><select name="price" aria-label="Lọc theo học phí"><option value="">Tất cả học phí</option><option value="free" ${price === "free" ? "selected" : ""}>Miễn phí</option><option value="paid" ${price === "paid" ? "selected" : ""}>Có học phí</option></select><select name="sort" aria-label="Sắp xếp khóa học"><option value="newest">Mới nhất</option><option value="name" ${sort === "name" ? "selected" : ""}>Tên A–Z</option><option value="price-asc" ${sort === "price-asc" ? "selected" : ""}>Giá tăng dần</option><option value="price-desc" ${sort === "price-desc" ? "selected" : ""}>Giá giảm dần</option></select><button class="btn btn-secondary btn-sm" type="submit">Tìm kiếm</button></form><div class="section-heading"><p>${count(total)} khóa học ${search ? "phù hợp với tìm kiếm" : mine ? "trong không gian của bạn" : "đang chờ bạn khám phá"}</p>${search || category || price ? '<button class="btn btn-ghost btn-sm" data-action="clear-filters">Bỏ bộ lọc</button>' : ""}</div><div class="course-grid">${shown.length ? shown.map((course) => courseCard(course, mine || progressOnly)).join("") : empty(mine ? "Chưa có khóa học nào" : "Không tìm thấy khóa học", mine ? (is("Staff") ? "Tạo khóa học hoặc chờ quản trị viên phân công cho bạn." : "Chọn một khóa học trong thư viện để bắt đầu hành trình.") : "Thử một từ khóa khác hoặc bỏ bớt bộ lọc.", mine ? linkButton("Khám phá khóa học", "#/courses", "primary") : button("Bỏ bộ lọc", "clear-filters", "secondary"))}</div>${totalPages > 1 ? pagination(page, totalPages, total) : ""}`
  );
}
function pagination(page, totalPages, total) {
  const start = Math.max(1, Math.min(page - 2, totalPages - 4)),
    end = Math.min(totalPages, start + 4);
  return `<div class="pagination"><span>${count(total)} kết quả · Trang ${page}/${totalPages}</span><div class="page-buttons"><button data-action="page" data-id="${page - 1}" ${page <= 1 ? "disabled" : ""} aria-label="Trang trước">${icon("back")}</button>${Array.from(
    { length: end - start + 1 },
    (_, i) => {
      const value = start + i;
      return `<button class="${value === page ? "current" : ""}" data-action="page" data-id="${value}" ${value === page ? 'aria-current="page"' : ""}>${value}</button>`;
    },
  ).join(
    "",
  )}<button data-action="page" data-id="${page + 1}" ${page >= totalPages ? "disabled" : ""} aria-label="Trang sau">${icon("next")}</button></div></div>`;
}
function categoriesPage() {
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
function detailTabs(course, active) {
  const tabs = [
    ["lessons", `Nội dung khóa học (${lessonsFor(course.id).length})`],
  ];
  if (canManage(course)) tabs.push(["students", "Sinh viên & tiến độ"]);
  tabs.push(["resources", "Học liệu & ảnh bìa"]);
  return `<div class="tabs" role="tablist" aria-label="Thông tin khóa học">${tabs.map(([key, label]) => `<button class="tab ${active === key ? "active" : ""}" role="tab" id="tab-${key}" aria-selected="${active === key}" tabindex="${active === key ? 0 : -1}" aria-controls="detail-tab-panel" data-action="course-tab" data-tab="${key}">${label}</button>`).join("")}</div>`;
}
async function courseDetail(route, version) {
  const course = await request(`/courses/${route.id}`);
  if (version !== renderVersion) return "";
  state.courseDetail = course;
  const lessons = lessonsFor(course.id),
    progress = enrolled(course.id)
      ? await request(`/progress/courses/${course.id}`)
      : null;
  if (version !== renderVersion) return "";
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
    body = `<section class="panel"><div class="panel-heading"><div><h2>Ảnh bìa khóa học</h2><p class="text-muted text-small">JPG, PNG hoặc WebP · Tối đa 5 MB</p></div>${canManage(course) ? button(`${icon("upload")}Tải ảnh lên`, "upload-image", "secondary", `data-id="${course.id}"`) : ""}</div>${files.length ? `<div class="document-list">${files.map((file) => fileRow(file, canManage(course), canManage(course) || enrolled(course.id))).join("")}</div>` : '<p class="text-muted text-small">Chưa có ảnh bìa được tải lên.</p>'}</section><section class="panel"><h2>Tài liệu bài học</h2><p class="text-muted text-small">${canManage(course) ? "Mở từng bài học để tải lên và quản lý tài liệu PDF." : "Mở bài học sau khi ghi danh để xem và tải các tài liệu PDF được nhân viên chia sẻ."}</p><a href="#/courses/${course.id}" class="btn btn-secondary btn-sm">Xem danh sách bài học</a></section>`;
  }
  return `<a class="back-link" href="#/courses">${icon("back")}Thư viện khóa học</a><section class="course-detail-header"><div><span class="badge">${esc(categoryName(course))}</span><h1>${esc(course.title)}</h1><p>${esc(course.description || "Nội dung giới thiệu đang được cập nhật.")}</p><div class="detail-meta"><span>${icon("user")}${esc(course.instructorName || "Chưa phân công giảng viên")}</span><span>${icon("users")}${esc(course.staffName || "Chưa phân công nhân viên")}</span><span>${icon("book")}${count(lessons.length)} bài học</span><span>${icon("clock")}${count(lessons.reduce((sum, item) => sum + item.durationMinutes, 0))} phút</span></div>${is("Admin") ? `<div class="detail-meta">${button(`${icon("user")}Phân công giảng viên`, "assign-instructor", "secondary", `data-id="${course.id}"`)}${button(`${icon("users")}Phân công nhân viên`, "assign-staff", "secondary", `data-id="${course.id}"`)}</div>` : ""}</div><aside>${cover(course, true)}<div class="detail-price-row"><span class="text-small text-muted">Học phí khóa học</span><span class="course-price ${Number(course.price) === 0 ? "free" : ""}">${money(course.price)}</span></div><div class="detail-actions">${actions}</div>${enrolled(course.id) ? '<p class="text-small" style="color:#648854;margin:12px 0 0">Bạn đã ghi danh khóa học này.</p>' : ""}</aside></section>${detailTabs(course, tab)}<section id="detail-tab-panel" role="tabpanel" aria-labelledby="tab-${tab}">${body}</section>`;
}
function fileRow(file, manage, download = true) {
  const size =
    file.size >= 1000000
      ? `${(file.size / 1000000).toFixed(1)} MB`
      : `${Math.ceil(file.size / 1000)} KB`;
  return `<div class="document-row">${icon("file")}<div class="document-info"><strong>${esc(file.originalName)}</strong><small>${size} · ${date(file.uploadedAt)}</small></div>${download ? toolsButton("download", "download-file", file.id, `Tải ${file.originalName}`, `data-name="${esc(file.originalName)}"`) : '<span class="badge neutral">Cần ghi danh để tải</span>'}${manage ? toolsButton("trash", "delete-file", file.id, `Xóa ${file.originalName}`) : ""}</div>`;
}
async function lessonPage(route, version) {
  const lesson = await request(`/lessons/${route.id}`);
  if (version !== renderVersion) return "";
  state.lessonDetail = lesson;
  const course =
    state.courses.find((item) => item.id === lesson.courseId) ||
    (await request(`/courses/${lesson.courseId}`));
  const [files, progress] = await Promise.all([
    request(`/files/lessons/${lesson.id}`),
    is("User")
      ? request(`/progress/courses/${course.id}`)
      : Promise.resolve(null),
  ]);
  const done = progress?.lessons.find(
    (item) => item.lessonId === lesson.id,
  )?.isCompleted;
  const lessons = lessonsFor(course.id),
    position = lessons.findIndex((item) => item.id === lesson.id),
    next = lessons[position + 1],
    url = safeUrl(lesson.videoUrl);
  return `<div class="lesson-reader"><a class="back-link" href="#/courses/${course.id}">${icon("back")}${esc(course.title)}</a><article class="panel"><div class="course-category">BÀI ${lesson.orderIndex} · ${count(lesson.durationMinutes)} PHÚT</div><h1>${esc(lesson.title)}</h1>${url ? `<div class="form-info">${linkButton(`${icon("play")}Mở video bài học`, url, "secondary")}<p style="margin:12px 0 0">Video được mở tại địa chỉ do nhân viên cung cấp.</p></div>` : ""}<div class="lesson-content">${esc(lesson.content || "Nội dung bài học đang được cập nhật. Hãy xem video hoặc tài liệu đính kèm nếu có.")}</div><div class="reader-footer">${is("User") ? button(`${icon(done ? "check" : "target")}${done ? "Đã hoàn thành · Bỏ đánh dấu" : "Đánh dấu hoàn thành"}`, "toggle-complete", done ? "secondary" : "primary", `data-id="${lesson.id}" data-completed="${Boolean(done)}"`) : button(`${icon("edit")}Chỉnh sửa bài học`, "edit-lesson", "secondary", `data-id="${lesson.id}"`)}${next ? linkButton(`Bài tiếp theo: ${esc(next.title)}`, `#/lesson/${next.id}`, "secondary") : linkButton("Về khóa học", `#/courses/${course.id}`, "secondary")}</div></article><section class="panel"><div class="panel-heading"><div><h2>Tài liệu học tập</h2><p class="text-small text-muted">Tất cả tài liệu bạn cần cho bài học này.</p></div>${canManage(course) ? button(`${icon("upload")}Tải PDF lên`, "upload-document", "secondary", `data-id="${lesson.id}"`) : ""}</div><div class="document-list">${files.length ? files.map((file) => fileRow(file, canManage(course))).join("") : '<p class="text-muted text-small">Chưa có tài liệu đính kèm.</p>'}</div></section></div>`;
}
async function usersPage(route, version) {
  const params = {
    PageNumber: Math.max(1, Number(route.params.get("page")) || 1),
    PageSize: 10,
    SearchTerm: route.params.get("search") || "",
    Role: is("Admin") ? route.params.get("role") || "" : "User",
    SortBy: "createdat",
    IsDescending: true,
  };
  const result = await request("/users?" + query(params));
  if (version !== renderVersion) return "";
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
        : "Xem tài khoản User và hỗ trợ đặt lại mật khẩu. Chỉ Admin được tạo, xóa hoặc cấp quyền.",
      actions,
    ) +
    `<form id="user-filter" class="toolbar" role="search"><div class="search-field">${icon("search")}<input type="search" name="search" value="${esc(params.SearchTerm)}" placeholder="Tìm theo tên hoặc email…" aria-label="Tìm tài khoản" maxlength="200"/></div><select name="role" aria-label="Vai trò">${is("Admin") ? '<option value="">Tất cả vai trò</option>' : ""}${options.map(([value, label]) => `<option value="${value}" ${value === params.Role ? "selected" : ""}>${label}</option>`).join("")}</select><button type="submit" class="btn btn-secondary btn-sm">Tìm kiếm</button><span class="result-count">${count(result.totalCount)} tài khoản</span></form>${result.items.length ? `<div class="table-wrap"><table><thead><tr><th>Tài khoản</th><th>Vai trò</th><th>Ngày tham gia</th><th style="text-align:right">Thao tác</th></tr></thead><tbody>${result.items.map((user) => `<tr><td><div class="cell-user">${avatar(user.fullName)}<div><strong>${esc(user.fullName)}${user.id === state.user.id ? ' <span class="text-muted">(Bạn)</span>' : ""}</strong><small>${esc(user.email)}</small></div></div></td><td><span class="badge ${user.role === "Admin" ? "purple" : user.role === "Staff" ? "blue" : ""}">${roleName[user.role] || esc(user.role)}</span></td><td>${date(user.createdAt)}</td><td><div class="table-actions">${is("Admin") && user.id !== state.user.id ? toolsButton("shield", "edit-role", user.id, "Thay đổi vai trò") : ""}${canResetPassword(state.user, user) ? toolsButton("lock", "reset-password", user.id, "Đặt lại mật khẩu") : ""}${is("Admin") && user.id !== state.user.id ? toolsButton("trash", "delete-user", user.id, "Xóa tài khoản") : ""}</div></td></tr>`).join("")}</tbody></table></div>${pagination(result.pageNumber, Math.max(result.totalPages, 1), result.totalCount)}` : empty("Không có tài khoản phù hợp", "Thử tên, email hoặc vai trò khác.")}`
  );
}
async function enrollmentsPage(route, _version) {
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
async function instructorStudentsPage(route) {
  const courses = state.courses.filter((course) => canManage(course));
  const selected = courses.find((course) => course.id === Number(route.params.get("course"))) || courses[0];
  const search = route.params.get("search") || "";
  const result = selected ? await request(`/progress/courses/${selected.id}/students`) : { students: [] };
  const students = result.students.filter((item) => `${item.studentName} ${item.studentEmail}`.toLocaleLowerCase("vi").includes(search.toLocaleLowerCase("vi")));
  return heading("Học viên của tôi", "Theo dõi học viên và tiến độ trong các khóa bạn giảng dạy.") +
    `<form id="enrollment-filter" class="toolbar"><div class="search-field">${icon("search")}<input type="search" name="search" value="${esc(search)}" placeholder="Tìm học viên…" aria-label="Tìm học viên" maxlength="200"/></div><select name="course" aria-label="Khóa học">${courses.map(course => `<option value="${course.id}" ${course.id === selected?.id ? "selected" : ""}>${esc(course.title)}</option>`).join("")}</select><button class="btn btn-secondary btn-sm" type="submit">Tìm kiếm</button><span class="result-count">${count(students.length)} học viên</span></form>` +
    (students.length ? `<div class="table-wrap"><table><thead><tr><th>Học viên</th><th>Ngày ghi danh</th><th>Tiến độ</th></tr></thead><tbody>${students.map(item => `<tr><td><div class="cell-user">${avatar(item.studentName)}<div><strong>${esc(item.studentName)}</strong><small>${esc(item.studentEmail)}</small></div></div></td><td>${date(item.enrolledAt)}</td><td>${progressBar(item)}</td></tr>`).join("")}</tbody></table></div>` : empty(selected ? "Chưa có học viên phù hợp" : "Chưa có khóa học được phân công", selected ? "Học viên ghi danh khóa này sẽ xuất hiện tại đây." : "Tạo khóa học hoặc chờ Admin phân công cho bạn."));
}
let displayedPurchase = null;
async function purchasesPage(route, version) {
  displayedPurchase = null;
  if (!route.id) {
    const page = Math.max(1, Number(route.params.get("page")) || 1);
    const purchases = await request(`/purchases${is("Admin") ? "" : "/my"}?page=${page}`);
    return purchaseList(purchases, is("Admin"), page);
  }
  const purchase = await request(`/purchases/${route.id}`);
  if (version !== renderVersion) return "";
  displayedPurchase = purchase;
  return purchaseDetail(purchase);
}
function schedulePurchasePoll(id, version) {
  if (version !== renderVersion || displayedPurchase?.status !== "PendingPayment" || !displayedPurchase.checkoutUrl) return;
  purchasePollTimer = setTimeout(async () => {
    if (version !== renderVersion || currentRoute().page !== "purchases" || currentRoute().id !== id || !getToken()) return;
    if (document.visibilityState !== "hidden") {
      try {
        const updated = await request(`/purchases/${id}/sync`, { method: "POST" });
        if (version !== renderVersion) return;
        if (updated.status !== displayedPurchase.status) {
          state.ready = false;
          return render();
        }
      } catch { /* Keep the bill visible; the user can retry the explicit check. */ }
    }
    schedulePurchasePoll(id, version);
  }, 10000);
}
function profilePage() {
  const user = state.user,
    definition = ROLE_DEFINITIONS[user.role];
  return (
    heading("Tài khoản của bạn", "Thông tin và quyền sử dụng hệ thống.") +
    `<section class="profile-card"><div class="profile-hero">${avatar(user.fullName)}<div><h2>${esc(user.fullName)}</h2><span class="badge ${is("Admin") ? "purple" : is("Staff") ? "blue" : ""}">${roleName[user.role]}</span></div></div><dl class="profile-grid"><div><dt>Họ và tên</dt><dd>${esc(user.fullName)}</dd></div><div><dt>Email</dt><dd>${esc(user.email)}</dd></div><div><dt>Vai trò</dt><dd>${roleName[user.role]}</dd></div><div><dt>Mã tài khoản</dt><dd>#${user.id}</dd></div></dl><div class="form-info">${esc(definition.description)}</div><div class="page-actions">${linkButton("Xem quyền của tôi", "#/permissions")}${button(icon("logout") + "Đăng xuất", "logout", "secondary")}${is("Admin") ? linkButton("Tài liệu API", API_DOCS_URL) : ""}</div></section>`
  );
}
function permissionsPage() {
  const roles = Object.entries(ROLE_DEFINITIONS);
  const rows = [
    ["Xem thư viện và hồ sơ", null, { Admin: "Có", Staff: "Có", Instructor: "Có", User: "Có" }],
    ["Ghi danh, học bài và cập nhật tiến độ", "learning"],
    ["Quản lý danh mục", "catalog.manage"],
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
async function render() {
  clearTimeout(purchasePollTimer);
  const version = ++renderVersion,
    route = currentRoute();
  if (route.page === "my-courses" && is("Admin")) {
    navigate("courses");
    return;
  }
  setMenu(false);
  shell(route.page);
  main.setAttribute("aria-busy", "true");
  const privatePages = [
    "purchases",
    "my-courses",
    "progress",
    "users",
    "enrollments",
    "profile",
    "lesson",
    "permissions",
  ];
  if (privatePages.includes(route.page) && !state.user) {
    main.innerHTML =
      heading(
        "Không gian dành riêng cho bạn",
        "Đăng nhập để tiếp tục hành trình.",
      ) +
      empty(
        "Cùng bắt đầu nhé!",
        "Đăng nhập để xem khóa học, tiến độ và các tính năng dành cho tài khoản của bạn.",
        button("Đăng nhập", "login"),
      );
    main.setAttribute("aria-busy", "false");
    return;
  }
  if (
    !canAccessPage(state.user, route.page) &&
    privatePages.includes(route.page)
  ) {
    main.innerHTML = empty(
      "Không gian này dành cho vai trò khác",
      "Chọn một mục trong menu để tiếp tục.",
      linkButton("Về tổng quan", "#/dashboard", "primary"),
    );
    main.setAttribute("aria-busy", "false");
    return;
  }
  main.innerHTML =
    '<div class="initial-loading"><span class="spinner"></span>Đang tải dữ liệu…</div>';
  try {
    if (!state.ready) await loadData();
    if (version !== renderVersion) return;
    shell(route.page);
    let html;
    if (route.page === "dashboard") html = dashboard();
    else if (route.page === "courses")
      html = route.id ? await courseDetail(route, version) : coursesPage(route);
    else if (route.page === "my-courses") html = coursesPage(route, true);
    else if (route.page === "progress") html = coursesPage(route, true, true);
    else if (route.page === "categories") html = categoriesPage();
    else if (route.page === "users") html = await usersPage(route, version);
    else if (route.page === "enrollments")
      html = await enrollmentsPage(route, version);
    else if (route.page === "lesson") html = await lessonPage(route, version);
    else if (route.page === "profile") html = profilePage();
    else if (route.page === "purchases") html = await purchasesPage(route, version);
    else if (route.page === "permissions") html = permissionsPage();
    else
      html = empty(
        "Trang này không tồn tại",
        "Trở về không gian học tập để tiếp tục.",
        linkButton("Về tổng quan", "#/dashboard", "primary"),
      );
    if (version !== renderVersion) return;
    main.innerHTML = html;
    if (route.page === "purchases" && route.id) schedulePurchasePoll(route.id, version);
    document.title = `${$("#breadcrumb").textContent} · CourseFlow`;
  } catch (error) {
    if (version === renderVersion) main.innerHTML = errorBox(error.message);
  } finally {
    if (version === renderVersion) {
      main.setAttribute("aria-busy", "false");
      if (pendingTabFocus) {
        document
          .getElementById(pendingTabFocus)
          ?.focus({ preventScroll: true });
        pendingTabFocus = null;
      }
    }
  }
}
function closeDialog() {
  if (dialog.open) dialog.close();
  modalSubmit = null;
  dialog.classList.remove("wide");
}
function openDialog(
  title,
  subtitle,
  content,
  submit = null,
  { wide = false } = {},
) {
  closeDialog();
  dialog.classList.toggle("wide", wide);
  modalSubmit = submit;
  dialog.innerHTML = `<div class="dialog-header"><div><h2 id="dialog-title">${esc(title)}</h2>${subtitle ? `<p>${esc(subtitle)}</p>` : ""}</div><button class="icon-button" data-action="close-dialog" aria-label="Đóng hộp thoại">${icon("close")}</button></div><div class="dialog-body">${content}</div>`;
  dialog.showModal();
  // Focus the first editable field after the native dialog has established its focus scope.
  requestAnimationFrame(() =>
    dialog.querySelector('input:not([type="hidden"]),select,textarea')?.focus(),
  );
}
function field(
  label,
  name,
  {
    value = "",
    type = "text",
    required = true,
    maxlength,
    minimum,
    step,
    placeholder = "",
    hint = "",
    autocomplete,
  } = {},
) {
  const attrs = `name="${name}" id="field-${name}" ${required ? "required" : ""} ${maxlength ? `maxlength="${maxlength}"` : ""} ${minimum != null ? `${type === "number" ? "min" : "minlength"}="${minimum}"` : ""} ${step ? `step="${step}"` : ""} ${hint ? `aria-describedby="hint-${name}"` : ""}`;
  const input =
    type === "textarea"
      ? `<textarea ${attrs} rows="4" placeholder="${esc(placeholder)}">${esc(value)}</textarea>`
      : `<input ${attrs} type="${type}" value="${esc(value)}" placeholder="${esc(placeholder)}" ${autocomplete ? `autocomplete="${autocomplete}"` : ""}/>`;
  return `<div class="form-field"><label for="field-${name}">${label}${required ? ' <span class="text-muted" aria-hidden="true">*</span>' : ""}</label>${type === "password" ? `<div class="password-wrap">${input}<button type="button" class="icon-button" data-action="toggle-password" aria-label="Hiện mật khẩu" aria-pressed="false">${icon("eye")}</button></div>` : input}${hint ? `<small id="hint-${name}">${hint}</small>` : ""}</div>`;
}
function selectField(label, name, options, value = "", hint = "") {
  return `<div class="form-field"><label for="field-${name}">${label} <span class="text-muted" aria-hidden="true">*</span></label><select class="select-control" id="field-${name}" name="${name}" required>${options.map(([key, text]) => `<option value="${esc(key)}" ${String(key) === String(value) ? "selected" : ""}>${esc(text)}</option>`).join("")}</select>${hint ? `<small>${hint}</small>` : ""}</div>`;
}
const formError = '<div class="form-error" role="alert" hidden></div>';
const formFooter = (submit = "Lưu thay đổi", danger = false) =>
  `<div class="form-footer"><button type="button" class="btn btn-secondary" data-action="close-dialog">Hủy</button><button type="submit" class="btn btn-${danger ? "danger" : "primary"}">${submit}</button></div>`;
function modalForm(content, footer = "Lưu thay đổi") {
  return `<form id="modal-form">${formError}${content}${formFooter(footer)}</form>`;
}
function scheduleSessionExpiry(token) {
  clearTimeout(sessionTimer);
  try {
    const payload = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(
          atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
          (c) => c.charCodeAt(0),
        ),
      ),
    );
    const delay = payload.exp * 1000 - Date.now();
    sessionTimer = setTimeout(
      () => {
        if (getToken() === token) {
          setToken(null);
          window.dispatchEvent(new Event("session-expired"));
        }
      },
      Math.max(0, delay),
    );
  } catch {
    /* Server verification through /auth/me determines token validity. */
  }
}
function authDialog(mode = "login", { email = "", notice = "" } = {}) {
  const register = mode === "register";
  const content = `<div class="dialog-brand">${icon("layers")}COURSEFLOW</div><form id="modal-form">${formError}${notice ? `<div class="form-info" role="status">${esc(notice)}</div>` : ""}${register ? field("Họ và tên", "fullName", { maxlength: 100, autocomplete: "name", placeholder: "Nguyễn Minh Anh" }) : ""}${field("Địa chỉ email", "email", { value: email, type: "email", autocomplete: "username", placeholder: "ban@example.com" })}${field("Mật khẩu", "password", { type: "password", minimum: register ? 8 : undefined, autocomplete: register ? "new-password" : "current-password", placeholder: register ? "Ít nhất 8 ký tự" : "Nhập mật khẩu của bạn", hint: register ? "Tài khoản đăng ký mới có vai trò User (sinh viên)." : "" })}<button class="btn btn-primary auth-submit" type="submit">${register ? "Tạo tài khoản sinh viên" : "Đăng nhập"}</button><p class="auth-switch">${register ? "Đã có tài khoản?" : "Bạn mới đến CourseFlow?"} <button type="button" data-action="${register ? "login" : "register"}">${register ? "Đăng nhập" : "Tạo tài khoản"}</button></p><div class="auth-role-note">${icon("shield")}Không gian được cá nhân hóa theo vai trò của bạn: quản trị viên, nhân viên, giảng viên hoặc sinh viên.</div></form>`;
  openDialog(
    register ? "Bắt đầu hành trình của bạn." : "Chào mừng bạn trở lại.",
    register
      ? "Học điều mới, mở thêm cơ hội."
      : "Đăng nhập và tiếp tục những bước tiến của bạn.",
    content,
    async (form) => {
      const data = Object.fromEntries(new FormData(form));
      data.email = data.email.trim();
      if (register) {
        data.fullName = data.fullName.trim();
        if (!data.fullName) throw new Error("Vui lòng nhập họ và tên.");
        await request("/auth/register", { method: "POST", body: data });
      }
      let result;
      try {
        result = await request("/auth/login", {
          method: "POST",
          body: { email: data.email, password: data.password },
        });
      } catch (error) {
        if (!register) throw error;
        authDialog("login", {
          email: data.email,
          notice: "Tài khoản đã được tạo. Vui lòng đăng nhập bằng email này khi kết nối ổn định; bạn không cần đăng ký lại.",
        });
        toast(error.message, true);
        return;
      }
      setToken(result.token);
      scheduleSessionExpiry(result.token);
      state.user = result.user;
      state.ready = false;
      closeDialog();
      toast(
        register
          ? "Tạo tài khoản thành công. Chào mừng bạn!"
          : `Chào mừng ${result.user.fullName}!`,
      );
      const target = pendingRoute;
      pendingRoute = null;
      if (target) navigate(target);
      else await render();
    },
  );
}
async function refresh(message) {
  state.ready = false;
  await loadData();
  await render();
  if (message) toast(message);
}
async function saved(path, method, body, message) {
  const result = await request(path, { method, body });
  closeDialog();
  await refresh(message);
  return result;
}
function courseForm(id) {
  const course = id
    ? state.courses.find((item) => item.id === id) || state.courseDetail
    : null;
  if (!state.categories.length) {
    toast("Hãy tạo danh mục trước khi tạo khóa học.", true);
    if (canManageCatalog(state.user)) categoryForm();
    return;
  }
  const content = `<div class="form-grid"><div class="full">${field("Tên khóa học", "title", { value: course?.title, maxlength: 200, placeholder: "Ví dụ: Lập trình Web với ASP.NET Core" })}</div><div class="full">${field("Giới thiệu khóa học", "description", { value: course?.description, type: "textarea", required: false, placeholder: "Sinh viên sẽ học được gì trong khóa học này?" })}</div>${selectField(
    "Danh mục",
    "categoryId",
    state.categories.map((item) => [item.id, item.name]),
    course?.categoryId || state.categories[0].id,
  )}${field("Học phí (VNĐ)", "price", { type: "number", value: course?.price || 0, minimum: 0, step: 0.01, hint: "Nhập 0 cho khóa học miễn phí." })}</div>${is("Admin") ? '<p class="form-info" style="margin-top:18px">Sau khi tạo, mở chi tiết khóa học để phân công giảng viên và nhân viên.</p>' : ""}`;
  openDialog(
    course ? "Chỉnh sửa khóa học" : "Tạo một khóa học mới",
    "Chia sẻ kiến thức, tạo nên những bước tiến.",
    modalForm(content, course ? "Lưu thay đổi" : "Tạo khóa học"),
    async (form) => {
      const data = Object.fromEntries(new FormData(form));
      data.title = data.title.trim();
      data.categoryId = Number(data.categoryId);
      data.price = Number(data.price);
      if (!data.title) throw new Error("Vui lòng nhập tên khóa học.");
      const result = await request(course ? `/courses/${id}` : "/courses", {
        method: course ? "PUT" : "POST",
        body: data,
      });
      closeDialog();
      state.ready = false;
      await loadData();
      toast(course ? "Đã cập nhật khóa học." : "Đã tạo khóa học mới.");
      navigate(`courses/${course ? id : result.id}`);
    },
    { wide: true },
  );
}
function categoryForm(id) {
  const item = state.categories.find((item) => item.id === id);
  openDialog(
    item ? "Chỉnh sửa danh mục" : "Thêm danh mục mới",
    "Sắp xếp tri thức theo từng lĩnh vực.",
    modalForm(
      field("Tên danh mục", "name", {
        value: item?.name,
        maxlength: 100,
        placeholder: "Ví dụ: Công nghệ thông tin",
      }) +
        field("Mô tả", "description", {
          value: item?.description,
          type: "textarea",
          required: false,
        }),
      item ? "Lưu thay đổi" : "Tạo danh mục",
    ),
    async (form) => {
      const data = Object.fromEntries(new FormData(form));
      data.name = data.name.trim();
      if (!data.name) throw new Error("Vui lòng nhập tên danh mục.");
      await saved(
        item ? `/categories/${id}` : "/categories",
        item ? "PUT" : "POST",
        data,
        item ? "Đã cập nhật danh mục." : "Đã tạo danh mục mới.",
      );
    },
  );
}
async function lessonForm(id, courseId) {
  const lesson = id ? await request(`/lessons/${id}`) : null;
  const course = state.courses.find(
    (item) => item.id === (lesson?.courseId || courseId),
  );
  if (!course || !canManage(course)) {
    toast("Bạn không có quyền chỉnh sửa bài học này.", true);
    return;
  }
  const nextOrder =
    Math.max(0, ...lessonsFor(course.id).map((item) => item.orderIndex)) + 1;
  const content = `<div class="form-info">Khóa học: ${esc(course.title)}</div><div class="form-grid"><div class="full">${field("Tiêu đề bài học", "title", { value: lesson?.title, maxlength: 200 })}</div><div class="full">${field("Nội dung bài học", "content", { value: lesson?.content, type: "textarea", required: false, hint: "Nội dung được trình bày dưới dạng văn bản, giữ nguyên xuống dòng." })}</div><div class="full">${field("Địa chỉ video", "videoUrl", { value: lesson?.videoUrl, type: "url", required: false, maxlength: 1000, placeholder: "https://…", hint: "Đường dẫn HTTP hoặc HTTPS đến video bài học." })}</div>${field("Thứ tự bài học", "orderIndex", { type: "number", value: lesson?.orderIndex || nextOrder, minimum: 1, step: 1 })}${field("Thời lượng (phút)", "durationMinutes", { type: "number", value: lesson?.durationMinutes || 0, minimum: 0, step: 1 })}</div>`;
  openDialog(
    lesson ? "Chỉnh sửa bài học" : "Thêm bài học mới",
    "Một bước nhỏ trong hành trình của sinh viên.",
    modalForm(content, lesson ? "Lưu thay đổi" : "Thêm bài học"),
    async (form) => {
      const data = Object.fromEntries(new FormData(form));
      data.title = data.title.trim();
      data.courseId = course.id;
      data.orderIndex = Number(data.orderIndex);
      data.durationMinutes = Number(data.durationMinutes);
      if (!data.title) throw new Error("Vui lòng nhập tiêu đề bài học.");
      if (data.videoUrl && !safeUrl(data.videoUrl))
        throw new Error(
          "Địa chỉ video phải bắt đầu bằng http:// hoặc https://.",
        );
      await saved(
        lesson ? `/lessons/${id}` : "/lessons",
        lesson ? "PUT" : "POST",
        data,
        lesson ? "Đã cập nhật bài học." : "Đã thêm bài học mới.",
      );
    },
    { wide: true },
  );
}
function confirmAction(title, message, submitLabel, callback, danger = true) {
  openDialog(
    title,
    "",
    `<form id="modal-form">${formError}<p class="text-muted text-small">${esc(message)}</p>${formFooter(submitLabel, danger)}</form>`,
    async () => {
      await callback();
    },
  );
}
async function assignOperator(courseId, role) {
  const teacher = role === "Instructor";
  const label = teacher ? "Giảng viên" : "Nhân viên";
  const fieldName = teacher ? "instructorId" : "staffId";
  const [staffMembers, course] = await Promise.all([
    request(`/users?${query({ Role: role, PageSize: 100 })}`),
    request(`/courses/${courseId}`),
  ]);
  const choices = staffMembers.items.map((item) => [item.id, `${item.fullName} · ${item.email}`]);
  const currentId = course[fieldName];
  if (currentId && !choices.some(([id]) => id === currentId))
    choices.push([currentId, (teacher ? course.instructorName : course.staffName) || `#${currentId}`]);
  openDialog(
    `Phân công ${label.toLocaleLowerCase("vi")}`,
    teacher ? "Giảng viên quản lý nội dung và học viên trong khóa được giao." : "Phân công nhân viên hỗ trợ vận hành khóa học.",
    modalForm(
      `<div class="form-field"><label for="operator-search">Tìm ${label.toLocaleLowerCase("vi")}</label><div class="toolbar" style="margin-bottom:0"><input id="operator-search" type="search" placeholder="Tìm theo tên hoặc email…" maxlength="200"/><button class="btn btn-secondary btn-sm" type="button" data-action="find-operator" data-role="${role}" data-field="${fieldName}">Tìm</button></div><small>Tối đa 100 kết quả. Tìm theo tên hoặc email để thu hẹp danh sách.</small></div>${selectField(label, fieldName, [["none", "Chưa phân công / Bỏ phân công"], ...choices], currentId ?? "none")}`,
      "Lưu phân công",
    ),
    async (form) => {
      const selected = new FormData(form).get(fieldName);
      const id = selected === "none" ? null : Number(selected);
      if (id !== null && (!Number.isInteger(id) || id <= 0))
        throw new Error(`Vui lòng chọn ${label.toLocaleLowerCase("vi")}.`);
      await saved(
        `/courses/${courseId}/${teacher ? "instructor" : "staff"}`,
        "PUT",
        { [fieldName]: id },
        "Đã cập nhật phân công.",
      );
    },
  );
}
function userForm() {
  openDialog(
    "Thêm người dùng",
    "Tạo tài khoản và chọn vai trò phù hợp.",
    modalForm(
      field("Họ và tên", "fullName", { maxlength: 100, autocomplete: "name" }) +
        field("Email", "email", { type: "email", autocomplete: "username" }) +
        field("Mật khẩu ban đầu", "password", {
          type: "password",
          minimum: 8,
          autocomplete: "new-password",
          hint: "Ít nhất 8 ký tự.",
        }) +
        selectField("Vai trò", "role", Object.entries(roleName), "User"),
      "Tạo người dùng",
    ),
    async (form) => {
      const data = Object.fromEntries(new FormData(form));
      data.fullName = data.fullName.trim();
      data.email = data.email.trim();
      if (!data.fullName) throw new Error("Vui lòng nhập họ và tên.");
      await saved("/users", "POST", data, "Đã tạo người dùng mới.");
    },
  );
}
async function roleForm(id) {
  const user =
    state.users?.items.find((item) => item.id === id) ||
    (await request(`/users/${id}`));
  openDialog(
    "Thay đổi vai trò",
    user.fullName,
    modalForm(
      `<div class="form-info">${esc(user.email)}</div>${selectField("Vai trò", "role", Object.entries(roleName), user.role)}`,
    ),
    async (form) => {
      await saved(
        `/users/${id}/role`,
        "PUT",
        { role: new FormData(form).get("role") },
        "Đã cập nhật vai trò. Các phiên đăng nhập cũ đã được thu hồi.",
      );
    },
  );
}
async function passwordForm(id) {
  const user =
    state.users?.items.find((item) => item.id === id) ||
    (await request(`/users/${id}`));
  openDialog(
    "Đặt lại mật khẩu",
    user.fullName,
    modalForm(
      field("Mật khẩu mới", "newPassword", {
        type: "password",
        minimum: 8,
        autocomplete: "new-password",
        hint: "Ít nhất 8 ký tự. Tài khoản sẽ cần đăng nhập lại bằng mật khẩu mới.",
      }),
      "Đặt lại mật khẩu",
    ),
    async (form) => {
      await saved(
        `/users/${id}/reset-password`,
        "PUT",
        { newPassword: new FormData(form).get("newPassword") },
        "Đã đặt lại mật khẩu. Tài khoản cần đăng nhập lại.",
      );
    },
  );
}
function uploadForm(id, type) {
  const image = type === "image",
    max = image ? 5000000 : 10000000,
    extensions = image ? ["jpg", "jpeg", "png", "webp"] : ["pdf"];
  openDialog(
    image ? "Tải ảnh bìa khóa học" : "Tải tài liệu bài học",
    "Chia sẻ học liệu với sinh viên của bạn.",
    modalForm(
      `<div class="form-field"><label for="upload-file">${image ? "Chọn ảnh" : "Chọn tài liệu PDF"}</label><input id="upload-file" type="file" name="file" accept="${image ? ".jpg,.jpeg,.png,.webp" : ".pdf"}" required/><small>${image ? "JPG, PNG hoặc WebP · Tối đa 5 MB" : "PDF · Tối đa 10 MB"}</small></div>`,
      "Tải lên",
    ),
    async (form) => {
      const data = new FormData(form),
        file = data.get("file");
      if (!file?.size) throw new Error("Vui lòng chọn một file có nội dung.");
      if (file.size > max)
        throw new Error(`File vượt quá ${image ? 5 : 10} MB.`);
      if (!extensions.includes(file.name.split(".").pop().toLowerCase()))
        throw new Error("Định dạng file không được hỗ trợ.");
      await saved(
        image ? `/files/courses/${id}/image` : `/files/lessons/${id}/document`,
        "POST",
        data,
        "Đã tải file lên thành công.",
      );
    },
  );
}
function helpDialog() {
  openDialog(
    "Cùng khám phá CourseFlow",
    "Bốn vai trò, đúng công việc của bạn.",
    `<ol class="help-list"><li><strong>Khám phá:</strong> tìm khóa học theo tên, danh mục và học phí. Mở chi tiết để xem chương trình học.</li>${Object.values(
      ROLE_DEFINITIONS,
    )
      .map(
        (role) =>
          `<li><strong>${role.name}:</strong> ${esc(role.description)}</li>`,
      )
      .join(
        "",
      )}</ol><div class="form-info">Xem mục Vai trò & quyền để biết đầy đủ quyền của tài khoản. Chỉ Admin được cấp hoặc thay đổi vai trò.</div><button class="btn btn-primary full-width" data-action="close-dialog">Đã hiểu, bắt đầu thôi</button>`,
  );
}
async function logout(expired = false) {
  setToken(null);
  clearTimeout(sessionTimer);
  state.user = null;
  state.ready = false;
  state.enrollments = [];
  state.progress = [];
  state.userCounts = {};
  state.roleError = null;
  state.courseDetail = null;
  state.lessonDetail = null;
  state.users = null;
  state.students = null;
  pendingRoute = null;
  closeDialog();
  toast(
    expired
      ? "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
      : "Đã đăng xuất tài khoản.",
    expired,
  );
  navigate("dashboard");
}
function updateFilters(form) {
  const route = currentRoute(),
    params = new URLSearchParams(new FormData(form));
  for (const [key, value] of [...params]) if (!value.trim()) params.delete(key);
  navigate(`${route.page}${params.size ? `?${params}` : ""}`);
}
async function handleAction(target) {
  const action = target.dataset.action,
    id = Number(target.dataset.id);
  if (
    ["create-user", "edit-role", "delete-user", "assign-staff", "assign-instructor", "find-operator"].includes(
      action,
    ) &&
    !is("Admin")
  )
    throw new Error("Chỉ Admin được thực hiện thao tác này.");
  if (action === "toggle-menu")
    return setMenu(!$("#sidebar").classList.contains("open"));
  if (action === "close-menu") return setMenu(false);
  if (action === "login") return authDialog();
  if (action === "register") return authDialog("register");
  if (action === "close-dialog") return closeDialog();
  if (action === "help") return helpDialog();
  if (action === "logout")
    return confirmAction(
      "Đăng xuất tài khoản?",
      "Bạn có muốn đăng xuất tài khoản không?",
      "Đăng xuất",
      () => logout(),
      false,
    );
  if (action === "toggle-password") {
    const input = target.parentElement.querySelector("input"),
      show = input.type === "password";
    input.type = show ? "text" : "password";
    target.setAttribute("aria-label", show ? "Ẩn mật khẩu" : "Hiện mật khẩu");
    target.setAttribute("aria-pressed", String(show));
    return;
  }
  if (action === "refresh") return refresh();
  if (action === "purchase-print") {
    const invoice = await request(`/purchases/${id}/invoice`);
    return printPurchase(invoice.html);
  }
  if (action === "purchase-payment-link" || action === "purchase-sync") {
    await request(`/purchases/${id}/${action === "purchase-sync" ? "sync" : "payment-link"}`, { method: "POST" });
    state.ready = false;
    return render();
  }
  if (action === "create-course") return courseForm();
  if (action === "edit-course") return courseForm(id);
  if (action === "create-category") return categoryForm();
  if (action === "edit-category") return categoryForm(id);
  if (action === "create-lesson") return lessonForm(null, id);
  if (action === "edit-lesson") return lessonForm(id);
  if (action === "assign-staff") return assignOperator(id, "Staff");
  if (action === "assign-instructor") return assignOperator(id, "Instructor");
  if (action === "create-user") return userForm();
  if (action === "edit-role") return roleForm(id);
  if (action === "reset-password") return passwordForm(id);
  if (action === "upload-image") return uploadForm(id, "image");
  if (action === "upload-document") return uploadForm(id, "document");
  if (action === "page") {
    const route = currentRoute();
    route.params.set("page", id);
    navigate(`${route.page}?${route.params}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  if (action === "clear-filters") return navigate(currentRoute().page);
  if (action === "course-tab") {
    const route = currentRoute();
    route.params.set("tab", target.dataset.tab);
    navigate(`courses/${route.id}?${route.params}`);
    return;
  }
  if (action === "locked-lesson") {
    if (!state.user) {
      pendingRoute = `courses/${id}`;
      return authDialog();
    }
    return toast(
      "Ghi danh khóa học bằng tài khoản sinh viên để xem bài học.",
      true,
    );
  }
  if (action === "enroll") {
    if (!state.user) {
      pendingRoute = `courses/${id}`;
      return authDialog();
    }
    const course = state.courses.find((item) => item.id === id);
    if (!is("User")) throw new Error("Chức năng mua khóa học dành cho tài khoản User.");
    return openDialog("Thông tin mua khóa học", course?.title || "Khóa học", modalForm(
      `<div class="form-info">Học phí: <strong>${money(course?.price)}</strong>. ${Number(course?.price) > 0 ? "Thanh toán bằng QR hoặc trang thanh toán payOS." : "Khóa học miễn phí sẽ được mở ngay."}</div>` +
      field("Họ tên trên bill", "buyerName", { value: state.user.fullName, maxlength: 100, minimum: 2, autocomplete: "name" }) +
      `<p class="text-small">Email: ${esc(state.user.email)}</p>` +
      field("Số điện thoại", "buyerPhone", { required: false, maxlength: 30, type: "tel", autocomplete: "tel" }) +
      field("Địa chỉ", "buyerAddress", { required: false, maxlength: 300, autocomplete: "street-address" }),
      Number(course?.price) > 0 ? "Tạo đơn & thanh toán" : "Nhận khóa học và bill"), async form => {
        const purchase = await request("/purchases", { method: "POST", body: { ...Object.fromEntries(new FormData(form)), courseId: id } });
        closeDialog();
        state.ready = false;
        navigate(`purchases/${purchase.id}`);
        if (purchase.status === "PendingPayment" && purchase.paymentConfigured) {
          try { await request(`/purchases/${purchase.id}/payment-link`, { method: "POST" }); }
          catch (error) { toast(error.message, true); }
          if (currentRoute().page === "purchases" && currentRoute().id === purchase.id) void render();
        }
      });
  }
  if (action === "cancel-enrollment")
    return confirmAction(
      "Hủy ghi danh?",
      "Tiến độ học tập của bạn trong khóa học này sẽ bị xóa. Bạn có thể đăng ký lại sau.",
      "Hủy ghi danh",
      () =>
        saved(
          `/enrollments/${id}`,
          "DELETE",
          undefined,
          "Đã hủy ghi danh khóa học.",
        ),
    );
  if (action === "delete-course") {
    const course = state.courses.find((item) => item.id === id);
    return confirmAction(
      "Xóa khóa học?",
      `Bạn muốn xóa “${course?.title}”? Khóa học có bài học hoặc dữ liệu liên quan cần được xử lý trước.`,
      "Xóa khóa học",
      async () => {
        await request(`/courses/${id}`, { method: "DELETE" });
        closeDialog();
        state.ready = false;
        await loadData();
        toast("Đã xóa khóa học.");
        navigate("courses");
      },
    );
  }
  if (action === "delete-category") {
    const item = state.categories.find((item) => item.id === id);
    return confirmAction(
      "Xóa danh mục?",
      `Xóa “${item?.name}”? Danh mục đang có khóa học sẽ không thể xóa.`,
      "Xóa danh mục",
      () => saved(`/categories/${id}`, "DELETE", undefined, "Đã xóa danh mục."),
    );
  }
  if (action === "delete-lesson")
    return confirmAction(
      "Xóa bài học?",
      "Bài học và tiến độ liên quan sẽ bị xóa. Thao tác này không thể hoàn tác.",
      "Xóa bài học",
      async () => {
        const lesson = state.lessons.find((item) => item.id === id);
        await request(`/lessons/${id}`, { method: "DELETE" });
        closeDialog();
        await refresh("Đã xóa bài học.");
        if (currentRoute().page === "lesson")
          navigate(`courses/${lesson.courseId}`);
      },
    );
  if (action === "delete-user") {
    const user = state.users?.items.find((item) => item.id === id);
    return confirmAction(
      "Xóa tài khoản?",
      `Bạn muốn xóa tài khoản “${user?.fullName}”? Tài khoản có dữ liệu liên quan sẽ không thể xóa.`,
      "Xóa tài khoản",
      () => saved(`/users/${id}`, "DELETE", undefined, "Đã xóa tài khoản."),
    );
  }
  if (action === "delete-file")
    return confirmAction(
      "Xóa file học liệu?",
      "File sẽ bị xóa khỏi khóa học và không thể khôi phục.",
      "Xóa file",
      () => saved(`/files/${id}`, "DELETE", undefined, "Đã xóa file."),
    );
  if (action === "toggle-complete")
    return saved(
      `/progress/lessons/${id}/complete`,
      target.dataset.completed === "true" ? "DELETE" : "POST",
      undefined,
      target.dataset.completed === "true"
        ? "Đã bỏ đánh dấu hoàn thành."
        : "Thêm một bước tiến! Đã hoàn thành bài học.",
    );
  if (action === "download-file") {
    const blob = await request(`/files/${id}/download`, { blob: true }),
      url = URL.createObjectURL(blob),
      link = document.createElement("a");
    link.href = url;
    link.download = target.dataset.name || `hoc-lieu-${id}`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    return;
  }
  if (action === "find-operator") {
    const result = await request(
      `/users?${query({ Role: target.dataset.role, PageSize: 100, SearchTerm: $("#operator-search").value.trim() })}`,
    );
    const select = $(`#field-${target.dataset.field}`);
    if (select)
      select.innerHTML =
        '<option value="">Chọn tài khoản</option><option value="none">Chưa phân công / Bỏ phân công</option>' +
        result.items
          .map(
            (item) =>
              `<option value="${item.id}">${esc(item.fullName)} · ${esc(item.email)}</option>`,
          )
          .join("");
    if (!result.items.length) toast("Không tìm thấy tài khoản phù hợp.", true);
  }
}
document.addEventListener("click", async (event) => {
  if (event.target.closest(".skip-link")) {
    event.preventDefault();
    main.focus();
    return;
  }
  const target = event.target.closest("[data-action]");
  if (!target || target.disabled) return;
  event.preventDefault();
  try {
    target.disabled = true;
    await handleAction(target);
  } catch (error) {
    toast(error.message, true);
  } finally {
    if (target.isConnected) target.disabled = false;
  }
});
document.addEventListener("submit", async (event) => {
  const form = event.target;
  event.preventDefault();
  if (form.id === "global-search") {
    const data = new FormData(form);
    navigate(`courses?${query({ search: String(data.get("search")).trim() })}`);
    return;
  }
  if (["course-filter", "user-filter", "enrollment-filter"].includes(form.id))
    return updateFilters(form);
  if (form.id !== "modal-form" || !modalSubmit) return;
  const submit = form.querySelector('[type="submit"]');
  if (submit.disabled) return;
  const errorBox = $(".form-error", form),
    handler = modalSubmit;
  errorBox.hidden = true;
  submit.disabled = true;
  form.setAttribute("aria-busy", "true");
  try {
    await handler(form);
  } catch (error) {
    if (form.isConnected) {
      errorBox.textContent = error.message;
      errorBox.hidden = false;
      errorBox.scrollIntoView({ block: "nearest" });
    } else toast(error.message, true);
  } finally {
    submit.disabled = false;
    form.removeAttribute("aria-busy");
  }
});
document.addEventListener("change", (event) => {
  if (
    event.target.matches(
      "#course-filter select,#user-filter select,#enrollment-filter select",
    )
  )
    updateFilters(event.target.form);
});
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) {
    const rect = dialog.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      closeDialog();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.target.matches('.tab[role="tab"]')) {
    const tabs = [...event.target.closest(".tabs").querySelectorAll(".tab")];
    const index = tabs.indexOf(event.target);
    const destination = {
      ArrowRight: (index + 1) % tabs.length,
      ArrowLeft: (index - 1 + tabs.length) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    }[event.key];
    if (destination !== undefined) {
      event.preventDefault();
      pendingTabFocus = tabs[destination].id;
      tabs[destination].click();
    }
  }
  if (
    event.key === "/" &&
    !dialog.open &&
    !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)
  ) {
    event.preventDefault();
    $("#global-search input").focus();
  }
  if (event.key === "Escape") setMenu(false);
});
window.addEventListener("hashchange", () => {
  state.ready = false;
  void render();
  window.scrollTo(0, 0);
});
// Revalidate sessions and assignments when returning from another tab/application.
let syncTimer;
function synchronizeOnReturn() {
  if (document.visibilityState === "hidden") return;
  state.ready = false;
  clearTimeout(syncTimer);
  if (!dialog.open) syncTimer = setTimeout(() => void render(), 100);
}
window.addEventListener("focus", synchronizeOnReturn);
document.addEventListener("visibilitychange", synchronizeOnReturn);
window.addEventListener("session-expired", () => {
  void logout(true).catch((error) => {
    toast(error.message, true);
    void render();
  });
});
async function boot() {
  hydrateIcons();
  if (getToken()) {
    try {
      state.user = await request("/auth/me");
      scheduleSessionExpiry(getToken());
    } catch (error) {
      if (error.status === 401) setToken(null);
      else
        toast(
          "Không thể khôi phục phiên đăng nhập. Bạn có thể thử đăng nhập lại.",
          true,
        );
    }
  }
  await render();
}
void boot();
