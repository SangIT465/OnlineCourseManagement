import { request, query } from "./api/client.js";
import { state, view, is, loadData } from "./state/store.js";
import { canAccessPage } from "./auth/permissions.js";
import { createSession } from "./auth/session.js";
import { $, heading, empty, button, linkButton, errorBox, toast, hydrateIcons } from "./components/ui.js";
import { dialog, closeDialog, hasDialogCleanup, installDialogEvents } from "./components/dialog.js";
import { setMenu, shell } from "./components/shell.js";
import { currentRoute, navigate, setupRouter, updateFilters } from "./router.js";
import { installWorkspaceEffects } from "./features/workspaces.js";
import { dashboard } from "./pages/dashboard.js";
import { coursesPage, courseDetail, categoriesPage } from "./pages/courses.js";
import { lessonPage } from "./pages/lesson.js";
import { usersPage, profilePage, permissionsPage } from "./pages/accounts.js";
import { enrollmentsPage } from "./pages/enrollments.js";
import { purchasesPage, schedulePurchasePoll, stopPurchasePoll } from "./pages/purchases.js";
import { createCatalogForms } from "./forms/catalog.js";
import { createAccountForms } from "./forms/accounts.js";
import { createUploadForms } from "./forms/uploads.js";
import { createActions } from "./actions.js";

const main = $("#main-content");

setupRouter(render);
const { authDialog, logout, restoreSession } = createSession({ render });
const { handleAction } = createActions({
  saved, refresh, render, authDialog, logout,
  ...createCatalogForms({ saved }),
  ...createAccountForms({ saved }),
  ...createUploadForms({ saved }),
});
installDialogEvents();

async function render() {
  stopPurchasePoll();
  const version = ++view.renderVersion,
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
    if (version !== view.renderVersion) return;
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
    if (version !== view.renderVersion) return;
    main.innerHTML = html;
    if (route.page === "purchases") schedulePurchasePoll(route.id, version, render);
    document.title = `${$("#breadcrumb").textContent} · CourseFlow`;
  } catch (error) {
    if (version === view.renderVersion) main.innerHTML = errorBox(error.message);
  } finally {
    if (version === view.renderVersion) {
      main.setAttribute("aria-busy", "false");
      if (view.pendingTabFocus) {
        document
          .getElementById(view.pendingTabFocus)
          ?.focus({ preventScroll: true });
        view.pendingTabFocus = null;
      }
    }
  }
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

document.addEventListener("submit", (event) => {
  const form = event.target;
  if (form.id === "global-search") {
    event.preventDefault();
    const data = new FormData(form);
    navigate(`courses?${query({ search: String(data.get("search")).trim() })}`);
  } else if (["course-filter", "user-filter", "enrollment-filter"].includes(form.id)) {
    event.preventDefault();
    updateFilters(form);
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
      view.pendingTabFocus = tabs[destination].id;
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
  if (hasDialogCleanup()) closeDialog();
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
  installWorkspaceEffects();
  hydrateIcons();
  await restoreSession();
  await render();
}

void boot();
