import { escapeHtml as esc } from "../api/client.js";
import { icon } from "./icons.js";
import { count, money, date, initials } from "../utils/format.js";
import { categoryName, lessonsFor, progressFor, enrolled, canManage } from "../state/store.js";

export const $ = (selector, root = document) => root.querySelector(selector);

export const avatar = (name, extra = "") =>
  `<span class="avatar ${extra}" aria-hidden="true">${esc(initials(name))}</span>`;

export const button = (label, action, style = "primary", extra = "") =>
  `<button class="btn btn-${style}" data-action="${action}" ${extra}>${label}</button>`;
export const linkButton = (label, href, style = "secondary") =>
  `<a class="btn btn-${style}" href="${esc(href)}" ${label === icon("play") ? 'aria-label="Mở bài học"' : ""}>${label}</a>`;
export const toolsButton = (name, action, id, label, extra = "") =>
  `<button class="icon-button ${name === "trash" ? "danger" : ""}" data-action="${action}" data-id="${id}" title="${esc(label)}" aria-label="${esc(label)}" ${extra}>${icon(name)}</button>`;
export const errorBox = (message) =>
  `<div class="error-panel">${icon("alert")}<h2>Chưa thể tải dữ liệu</h2><p>${esc(message)}</p>${button(`${icon("refresh")}Thử lại`, "refresh", "secondary")}</div>`;
export const empty = (title, description, action = "") =>
  `<div class="empty-state">${icon("book")}<h3>${esc(title)}</h3><p>${esc(description)}</p>${action}</div>`;
export function hydrateIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((node) => {
    node.innerHTML = icon(node.dataset.icon);
    node.removeAttribute("data-icon");
  });
}
export function toast(message, error = false) {
  const node = document.createElement("div");
  node.className = `toast${error ? " error" : ""}`;
  node.innerHTML = `${icon(error ? "alert" : "check")}<span>${esc(message)}</span><button aria-label="Đóng thông báo">×</button>`;
  node.querySelector("button").onclick = () => node.remove();
  $("#toast-region").append(node);
  setTimeout(() => node.remove(), error ? 8000 : 5000);
}

export function heading(title, description, actions = "") {
  return `<div class="page-heading"><div><h1>${esc(title)}</h1><p>${esc(description)}</p></div>${actions ? `<div class="page-actions">${actions}</div>` : ""}</div>`;
}

export function cover(course, full = false) {
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
export function courseCard(course, showProgress = false) {
  const lessons = lessonsFor(course.id),
    totalMinutes = lessons.reduce((sum, item) => sum + item.durationMinutes, 0),
    progress = progressFor(course.id);
  return `<article class="course-card"><a href="#/courses/${course.id}" tabindex="-1" aria-hidden="true">${cover(course)}</a><div class="course-card-body"><div class="course-category"><span class="category-dot"></span>${esc(categoryName(course))}</div><h3><a href="#/courses/${course.id}">${esc(course.title)}</a></h3><p class="course-description">${esc(course.description || "Khám phá kiến thức mới và phát triển kỹ năng qua từng bài học.")}</p><div class="course-instructor">${icon("user")}${esc(course.instructorName || "Chưa phân công giảng viên")}</div><div class="course-meta"><span>${icon("book")}${count(lessons.length)} bài học</span><span>${icon("clock")}${count(totalMinutes)} phút</span></div>${showProgress && progress ? progressBar(progress) : ""}<div class="course-card-footer"><span class="course-price ${Number(course.price) === 0 ? "free" : ""}">${money(course.price)}</span><a class="course-open" href="#/courses/${course.id}">${enrolled(course.id) ? "Vào học" : canManage(course) ? "Quản lý" : "Xem khóa học"}</a></div></div></article>`;
}
export function progressBar(item) {
  return `<div class="progress-block"><div class="progress-caption"><span>${count(item.completedLessons)}/${count(item.totalLessons)} bài học</span><strong>${count(item.percentage)}%</strong></div><div class="progress-track" role="progressbar" aria-label="Tiến độ học tập" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Number(item.percentage) || 0}"><div class="progress-fill" style="width:${Math.min(100, Math.max(0, Number(item.percentage) || 0))}%"></div></div></div>`;
}
export function statCard(label, value, name, note) {
  return `<article class="stat-card"><div class="stat-top"><span class="stat-label">${esc(label)}</span><span class="stat-icon">${icon(name)}</span></div><div class="stat-value">${esc(value)}</div><div class="stat-note">${icon("check")}${esc(note)}</div></article>`;
}

export function pagination(page, totalPages, total) {
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

export function fileRow(file, manage, download = true) {
  const size =
    file.size >= 1000000
      ? `${(file.size / 1000000).toFixed(1)} MB`
      : `${Math.ceil(file.size / 1000)} KB`;
  return `<div class="document-row">${icon("file")}<div class="document-info"><strong>${esc(file.originalName)}</strong><small>${size} · ${date(file.uploadedAt)}</small></div><div class="document-actions">${download ? `<button class="btn btn-secondary btn-sm" data-action="preview-file" data-id="${Number(file.id)}" data-name="${esc(file.originalName)}" title="Xem trực tiếp ${esc(file.originalName)}">${icon("eye")}Xem</button>${toolsButton("download", "download-file", file.id, `Tải ${file.originalName}`, `data-name="${esc(file.originalName)}"`)}` : '<span class="badge neutral">Cần ghi danh để xem</span>'}${manage ? toolsButton("trash", "delete-file", file.id, `Xóa ${file.originalName}`) : ""}</div></div>`;
}
