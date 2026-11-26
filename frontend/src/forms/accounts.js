import { request, escapeHtml as esc } from "../api/client.js";
import { ROLE_NAMES as roleName, canSupportEnrollment } from "../auth/permissions.js";
import { money } from "../utils/format.js";
import { state } from "../state/store.js";
import { openDialog, field, selectField, modalForm } from "../components/dialog.js";

export function createAccountForms({ saved }) {
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

  async function supportEnrollmentForm(id) {
    const user = await request(`/users/${id}`);
    if (!canSupportEnrollment(state.user, user))
      throw new Error("Chỉ Admin và Nhân viên được hỗ trợ ghi danh cho sinh viên.");
    const courses = await request("/courses");
    if (!courses.length) throw new Error("Chưa có khóa học để ghi danh.");
    openDialog("Ghi danh hỗ trợ", `${user.fullName} · ${user.email}`,
      modalForm(
        '<div class="form-info">Có thể ghi danh khóa miễn phí hoặc khôi phục quyền học cho khóa đã có đơn thanh toán thành công. Học phí và trạng thái đơn được kiểm tra khi lưu.</div>' +
        selectField("Khóa học", "courseId", [["", "Chọn khóa học"], ...courses.map(course => [course.id, `${course.title} · ${money(course.price)}`])]),
        "Ghi danh học viên"),
      async form => saved("/enrollments/support", "POST", {
        studentId: user.id, courseId: Number(new FormData(form).get("courseId")),
      }, "Đã ghi danh học viên. Danh sách ghi danh và quyền học đã được cập nhật."));
  }

  return { userForm, roleForm, passwordForm, supportEnrollmentForm };
}
