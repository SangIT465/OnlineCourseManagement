import { request, query, escapeHtml as esc, safeUrl } from "../api/client.js";
import { canManageCatalog } from "../auth/permissions.js";
import { state, is, canManage, lessonsFor, loadData } from "../state/store.js";
import { navigate } from "../router.js";
import { toast } from "../components/ui.js";
import {
  closeDialog,
  openDialog,
  field,
  selectField,
  modalForm,
} from "../components/dialog.js";

export function createCatalogForms({ saved }) {
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

  return { courseForm, categoryForm, lessonForm, assignOperator };
}
