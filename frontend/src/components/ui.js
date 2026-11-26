import { escapeHtml as esc } from "../api/client.js";
import { icon } from "./icons.js";
import { courseArtwork } from "./course-artwork.js";
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
  const category = categoryName(course);
  return `<div class="course-cover" ${full ? "" : 'aria-hidden="true"'}><img class="course-cover-image" src="${courseArtwork(course, category)}" alt="${full ? esc(`Ảnh minh họa khóa học ${course.title}`) : ""}" width="960" height="600" loading="${full ? "eager" : "lazy"}" decoding="async" /><span class="cover-category">${esc(category)}</span><span class="cover-brand">${icon("graduation")}CourseFlow<span class="cover-brand-divider"></span>Học để tiến xa</span></div>`;
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
