import { escapeHtml as esc } from "../api/client.js";
import { icon } from "./icons.js";
import { $, avatar, button, toolsButton, hydrateIcons } from "./ui.js";
import { count } from "../utils/format.js";
import { state, is } from "../state/store.js";
import { ROLE_NAMES as roleName, canManageCatalog } from "../auth/permissions.js";
import { workspaceFor } from "../features/workspaces.js";

export function setMenu(open) {
  $("#sidebar").classList.toggle("open", open);
  $(".sidebar-scrim").hidden = !open;
  $('[data-action="toggle-menu"]').setAttribute("aria-expanded", String(open));
}
export function shell(page) {
  const workspace = workspaceFor(state.user);
  document.body.dataset.workspace = workspace.key;
  document.body.dataset.page = page;
  $(".brand small").textContent = workspace.caption;
  $(".workspace-label").textContent = workspace.name.toLocaleUpperCase("vi");
  $(".breadcrumb-root").textContent = workspace.name;
  $("#workspace-chip").innerHTML = `${icon(workspace.icon)}<span>${esc(workspace.short)}</span>`;
  $(".sidebar-note").innerHTML = `<span class="note-spark" aria-hidden="true">✦</span><h3>${esc(workspace.note)}</h3><p>${esc(workspace.description)}</p><a href="${workspace.link}">${esc(workspace.linkText)}${icon("next")}</a>`;
  const routes = [
    ["dashboard", "grid", workspace.title],
    ["courses", is("Admin") ? "book" : "compass", is("Admin") ? "Quản lý khóa học" : "Khám phá"],
  ];
  if (state.user && !is("Admin"))
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
  if (state.user && !is("User")) management.push(["permissions", "shield", "Vai trò & quyền"]);
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
    (page === "profile" ? "Tài khoản" : page === "permissions" ? "Vai trò & quyền" : "Khóa học");
  const mobileRoutes = is("Admin") ? [["dashboard","grid","Điều hành"],["courses","book","Khóa học"],["users","users","Tài khoản"],["purchases","shield","Đơn mua"]]
    : is("Staff") ? [["dashboard","grid","Công việc"],["my-courses","book","Phụ trách"],["users","users","Sinh viên"],["profile","user","Tài khoản"]]
    : is("Instructor") ? [["dashboard","grid","Giảng dạy"],["my-courses","book","Khóa học"],["enrollments","users","Học viên"],["profile","user","Tài khoản"]]
    : is("User") ? [["dashboard","grid","Trang chủ"],["courses","compass","Khám phá"],["my-courses","book","Khóa của tôi"],["profile","user","Tài khoản"]] : [];
  $("#mobile-workspace-nav").innerHTML = mobileRoutes.map(([route,symbol,label]) => `<a href="#/${route}" ${activePage === route ? 'aria-current="page"' : ""}>${icon(symbol)}<span>${esc(label)}</span></a>`).join("");
  $("#mobile-workspace-nav").hidden = !mobileRoutes.length;
  $("#sidebar-account").innerHTML = state.user
    ? `<div class="sidebar-account">${avatar(state.user.fullName, "sidebar-avatar")}<a href="#/profile"><strong>${esc(state.user.fullName)}</strong><small>${roleName[state.user.role]}</small></a>${toolsButton("logout", "logout", 0, "Đăng xuất")}</div>`
    : `<div class="sidebar-account">${avatar("Khách", "sidebar-avatar")}<div><strong>Xin chào, bạn!</strong><small>Khám phá cùng CourseFlow</small></div></div>`;
  $("#topbar-account").innerHTML = state.user
    ? `<a href="#/profile" class="topbar-user" aria-label="Tài khoản ${esc(state.user.fullName)}">${avatar(state.user.fullName)}<span class="user-label"><strong>${esc(state.user.fullName.split(" ").slice(-2).join(" "))}</strong><small>${roleName[state.user.role]}</small></span></a>`
    : button("Đăng nhập", "login", "primary");
  hydrateIcons();
}
