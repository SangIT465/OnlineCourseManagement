import { request, escapeHtml as esc } from "../api/client.js";
import { ROLE_DEFINITIONS } from "../auth/permissions.js";
import { icon } from "./icons.js";
import { $, toast } from "./ui.js";

export const dialog = $("#app-dialog");
let modalSubmit = null;
let modalCleanup = null;
let eventsInstalled = false;

export async function downloadFile(id, name) {
  const blob = await request(`/files/${id}/download`, { blob: true });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name || `hoc-lieu-${id}`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export function closeDialog() {
  modalCleanup?.();
  modalCleanup = null;
  if (dialog.open) dialog.close();
  modalSubmit = null;
  dialog.classList.remove("wide", "file-preview-dialog");
}

export async function previewFile(id, name) {
  openDialog(name || "Xem tài liệu", "Xem trực tiếp trên website", '<div data-file-preview><p role="status">Đang tải tài liệu…</p></div>', null, { wide: true });
  dialog.classList.add("file-preview-dialog");
  const host = dialog.querySelector("[data-file-preview]");
  try {
    const { mountFilePreview } = await import("../features/file-preview.js");
    if (!dialog.open || !host.isConnected) return;
    modalCleanup = mountFilePreview(host, {
      name: name || `hoc-lieu-${id}`,
      load: (signal) => request(`/files/${id}/preview`, { blob: true, signal, timeoutMs: 90000 }),
      download: () => downloadFile(id, name),
    });
  } catch {
    if (dialog.open && host.isConnected) host.textContent = "Chưa mở được trình xem. Vui lòng đóng rồi thử lại.";
  }
}

export function openDialog(
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

export function field(
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

export function selectField(label, name, options, value = "", hint = "") {
  return `<div class="form-field"><label for="field-${name}">${label} <span class="text-muted" aria-hidden="true">*</span></label><select class="select-control" id="field-${name}" name="${name}" required>${options.map(([key, text]) => `<option value="${esc(key)}" ${String(key) === String(value) ? "selected" : ""}>${esc(text)}</option>`).join("")}</select>${hint ? `<small>${hint}</small>` : ""}</div>`;
}

export const formError = '<div class="form-error" role="alert" hidden></div>';
export const formFooter = (submit = "Lưu thay đổi", danger = false) =>
  `<div class="form-footer"><button type="button" class="btn btn-secondary" data-action="close-dialog">Hủy</button><button type="submit" class="btn btn-${danger ? "danger" : "primary"}">${submit}</button></div>`;

export function modalForm(content, footer = "Lưu thay đổi", { noValidate = false } = {}) {
  return `<form id="modal-form"${noValidate ? " novalidate" : ""}>${formError}${content}${formFooter(footer)}</form>`;
}

export function confirmAction(title, message, submitLabel, callback, danger = true) {
  openDialog(
    title,
    "",
    `<form id="modal-form">${formError}<p class="text-muted text-small">${esc(message)}</p>${formFooter(submitLabel, danger)}</form>`,
    async () => {
      await callback();
    },
  );
}

export function helpDialog() {
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

export function hasDialogCleanup() {
  return Boolean(modalCleanup || dialog.classList.contains("file-preview-dialog"));
}

export function installDialogEvents() {
  if (eventsInstalled) return;
  eventsInstalled = true;

  dialog.addEventListener("submit", async (event) => {
    const form = event.target;
    if (form.id !== "modal-form" || !modalSubmit) return;
    event.preventDefault();
    const submit = form.querySelector('[type="submit"]');
    if (submit.disabled) return;
    const errorBox = $(".form-error", form);
    const handler = modalSubmit;
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

  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeDialog();
  });

  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    ) closeDialog();
  });
}
