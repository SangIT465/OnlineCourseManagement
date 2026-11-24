import { request, escapeHtml as esc, safeUrl } from "../api/client.js";
import { icon } from "../components/icons.js";
import { button, linkButton, fileRow } from "../components/ui.js";
import { count } from "../utils/format.js";
import { state, view, is, canManage, lessonsFor } from "../state/store.js";

export async function lessonPage(route, version) {
  const lesson = await request(`/lessons/${route.id}`);
  if (version !== view.renderVersion) return "";
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
  return `<div class="lesson-reader"><a class="back-link" href="#/courses/${course.id}">${icon("back")}${esc(course.title)}</a><article class="panel"><div class="course-category">BÀI ${lesson.orderIndex} · ${count(lesson.durationMinutes)} PHÚT</div><h1>${esc(lesson.title)}</h1>${url ? `<div class="form-info">${linkButton(`${icon("play")}Mở video bài học`, url, "secondary")}<p style="margin:12px 0 0">Video được mở tại địa chỉ do nhân viên cung cấp.</p></div>` : ""}<div class="lesson-content">${esc(lesson.content || "Nội dung bài học đang được cập nhật. Hãy xem video hoặc tài liệu đính kèm nếu có.")}</div><div class="reader-footer">${is("User") ? button(`${icon(done ? "check" : "target")}${done ? "Đã hoàn thành · Bỏ đánh dấu" : "Đánh dấu hoàn thành"}`, "toggle-complete", done ? "secondary" : "primary", `data-id="${lesson.id}" data-completed="${Boolean(done)}"`) : button(`${icon("edit")}Chỉnh sửa bài học`, "edit-lesson", "secondary", `data-id="${lesson.id}"`)}${next ? linkButton(`Bài tiếp theo: ${esc(next.title)}`, `#/lesson/${next.id}`, "secondary") : linkButton("Về khóa học", `#/courses/${course.id}`, "secondary")}</div></article><section class="panel"><div class="panel-heading"><div><h2>Tài liệu học tập</h2><p class="text-small text-muted">Tất cả tài liệu bạn cần cho bài học này.</p></div>${canManage(course) ? button(`${icon("upload")}Tải tài liệu lên`, "upload-document", "secondary", `data-id="${lesson.id}"`) : ""}</div><div class="document-list">${files.length ? files.map((file) => fileRow(file, canManage(course))).join("") : '<p class="text-muted text-small">Chưa có tài liệu đính kèm.</p>'}</div></section></div>`;
}
