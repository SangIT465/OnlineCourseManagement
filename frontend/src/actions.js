import { request, query, escapeHtml as esc } from "./api/client.js";
import { state, view, is, loadData } from "./state/store.js";
import { currentRoute, navigate } from "./router.js";
import { money } from "./utils/format.js";
import { $, toast } from "./components/ui.js";
import { setMenu } from "./components/shell.js";
import {
  closeDialog,
  openDialog,
  helpDialog,
  confirmAction,
  modalForm,
  field,
  previewFile,
  downloadFile,
} from "./components/dialog.js";
import { printPurchase } from "./features/purchases.js";

export function createActions({
  saved,
  refresh,
  render,
  authDialog,
  logout,
  courseForm,
  categoryForm,
  lessonForm,
  assignOperator,
  userForm,
  roleForm,
  passwordForm,
  uploadForm,
}) {
  async function handleAction(target) {
    const action = target.dataset.action;
    const id = Number(target.dataset.id);
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
    if (action === "purchase-cancel") {
      return confirmAction("Hủy thanh toán?", "Đơn sẽ chuyển sang Đã hủy và được giữ trong lịch sử. Bạn có thể tạo đơn mới để mua lại khóa học.", "Hủy thanh toán", async () => {
        let result;
        try {
          result = await request(`/purchases/${id}/cancel`, { method: "POST" });
        } catch (error) {
          if (error.status !== 409) throw error;
          closeDialog();
          state.ready = false;
          await render();
          return toast(error.message, true);
        }
        closeDialog();
        state.ready = false;
        await render();
        toast(result.status === "Expired" ? "Đơn đã hết hạn thanh toán." : "Đã hủy thanh toán. Bill được giữ trong lịch sử.");
      });
    }
    if (action === "purchase-demo-confirm") {
      await request(`/purchases/${id}/demo-confirm`, { method: "POST" });
      state.ready = false;
      await render();
      return toast("Đã xác nhận thanh toán demo. Bạn đã nhận được khóa học.");
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
        view.pendingRoute = `courses/${id}`;
        return authDialog();
      }
      return toast(
        "Ghi danh khóa học bằng tài khoản sinh viên để xem bài học.",
        true,
      );
    }
    if (action === "enroll") {
      if (!state.user) {
        view.pendingRoute = `courses/${id}`;
        return authDialog();
      }
      const course = state.courses.find((item) => item.id === id);
      if (!is("User")) throw new Error("Chức năng mua khóa học dành cho tài khoản User.");
      return openDialog("Thông tin mua khóa học", course?.title || "Khóa học", modalForm(
        `<div class="form-info">Học phí: <strong>${money(course?.price)}</strong>. ${Number(course?.price) > 0 ? "Thanh toán bằng QR hoặc trang thanh toán payOS." : "Khóa học miễn phí sẽ được mở ngay."}</div>` +
        field("Họ tên trên bill", "buyerName", { value: state.user.fullName, maxlength: 100, minimum: 2, autocomplete: "name" }) +
        `<p class="text-small">Email: ${esc(state.user.email)}</p>` +
        field("Số điện thoại", "buyerPhone", { maxlength: 30, type: "tel", autocomplete: "tel", hint: "Nhập đúng 10 chữ số, không có khoảng trắng hoặc ký tự đặc biệt." }) +
        field("Địa chỉ", "buyerAddress", { maxlength: 300, autocomplete: "street-address" }),
        Number(course?.price) > 0 ? "Tạo đơn & thanh toán" : "Nhận khóa học và bill", { noValidate: true }), async form => {
          const body = Object.fromEntries(new FormData(form));
          const missing = [];
          for (const [name, label] of [["buyerPhone", "số điện thoại"], ["buyerAddress", "địa chỉ"]]) {
            if (!body[name].trim()) missing.push({ name, label });
          }
          if (missing.length) {
            form.elements.namedItem(missing[0].name).focus();
            throw new Error(`Vui lòng nhập ${missing.map(item => item.label).join(" và ")} trước khi tạo đơn mua.`);
          }
          if (body.buyerPhone.length !== 10 || /[^0-9]/.test(body.buyerPhone)) {
            form.elements.namedItem("buyerPhone").focus();
            throw new Error("Số điện thoại phải gồm đúng 10 chữ số từ 0–9, không có chữ, khoảng trắng hoặc ký tự đặc biệt.");
          }
          body.buyerAddress = body.buyerAddress.trim();
          if (!form.reportValidity()) return;
          const purchase = await request("/purchases", { method: "POST", body: { ...body, courseId: id } });
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
    if (action === "preview-file") return previewFile(id, target.dataset.name);
    if (action === "download-file") return downloadFile(id, target.dataset.name);
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

  return { handleAction };
}
