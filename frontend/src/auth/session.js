import { request, getToken, setToken, escapeHtml as esc } from "../api/client.js";
import { icon } from "../components/icons.js";
import { toast } from "../components/ui.js";
import { openDialog, closeDialog, field, formError } from "../components/dialog.js";
import { state, view } from "../state/store.js";
import { navigate } from "../router.js";

export function createSession({ render }) {
  let sessionTimer;

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
        const target = view.pendingRoute;
        view.pendingRoute = null;
        if (target) navigate(target);
        else await render();
      },
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
    view.pendingRoute = null;
    closeDialog();
    toast(
      expired
        ? "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
        : "Đã đăng xuất tài khoản.",
      expired,
    );
    navigate("dashboard");
  }

  async function restoreSession() {
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
  }

  return { authDialog, logout, restoreSession };
}
