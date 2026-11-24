import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { state, view, loadData } from "../src/state/store.js";
import { setToken } from "../src/api/client.js";
import { parseRoute } from "../src/router.js";
import { coursesPage, courseDetail } from "../src/pages/courses.js";
import { lessonPage } from "../src/pages/lesson.js";
import { usersPage } from "../src/pages/accounts.js";

const originalFetch = globalThis.fetch;
const originalStorage = globalThis.sessionStorage;

beforeEach(() => {
  const tokens = new Map();
  globalThis.sessionStorage = {
    getItem: (key) => tokens.get(key) ?? null,
    setItem: (key, value) => tokens.set(key, value),
    removeItem: (key) => tokens.delete(key),
  };
  Object.assign(state, {
    user: null,
    courses: [
      { id: 1, title: "Lập trình Web", categoryId: 1, price: 0, instructorId: 10, staffId: 20 },
      { id: 2, title: "Thiết kế UI", categoryId: 2, price: 50000, instructorId: 11, staffId: 21 },
    ],
    categories: [{ id: 1, name: "Công nghệ" }, { id: 2, name: "Thiết kế" }],
    lessons: [{ id: 3, title: "Bài đầu tiên", courseId: 1, orderIndex: 1, durationMinutes: 10 }],
    enrollments: [{ courseId: 1 }],
    progress: [{ courseId: 1, completedLessons: 1, totalLessons: 1, percentage: 100 }],
    userCounts: {},
    ready: false,
    roleError: null,
    courseDetail: null,
    lessonDetail: null,
    students: null,
    users: null,
  });
  view.renderVersion = 1;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.sessionStorage = originalStorage;
});

test("catalog combines Vietnamese search, category and price filters", () => {
  const html = coursesPage(parseRoute("#/courses?search=LẬP%20TRÌNH&category=1&price=free"));
  assert.match(html, /Lập trình Web/);
  assert.doesNotMatch(html, /href="#\/courses\/2"/);
  assert.match(html, /1 khóa học phù hợp/);
});

test("my courses keeps each teacher, operator and student in their own course list", () => {
  for (const user of [
    { id: 10, role: "Instructor" },
    { id: 20, role: "Staff" },
    { id: 30, role: "User" },
  ]) {
    state.user = user;
    const html = coursesPage(parseRoute("#/my-courses"), true);
    assert.match(html, /href="#\/courses\/1"/);
    assert.doesNotMatch(html, /href="#\/courses\/2"/);
  }
});

test("course pages escape stored titles and preserve learning progress", () => {
  state.user = { id: 30, role: "User" };
  state.courses[0].title = '<img src=x onerror="alert(1)">';
  const html = coursesPage(parseRoute("#/progress"), true, true);
  assert.match(html, /&lt;img/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /aria-valuenow="100"/);
  assert.match(html, /Vào học/);
});

test("late course responses cannot overwrite the active course detail", async () => {
  let respond;
  globalThis.fetch = () => new Promise((resolve) => { respond = resolve; });
  const rendering = courseDetail(parseRoute("#/courses/1"), 1);
  view.renderVersion = 2;
  respond(Response.json(state.courses[0]));
  assert.equal(await rendering, "");
  assert.equal(state.courseDetail, null);
});

test("lesson rendering rejects script video URLs and escapes content and filenames", async () => {
  state.user = { id: 30, role: "User" };
  globalThis.fetch = async (url) => {
    if (url === "/api/lessons/3") return Response.json({
      ...state.lessons[0], videoUrl: "javascript:alert(1)", content: "<script>bad()</script>",
    });
    if (url === "/api/files/lessons/3") return Response.json([
      { id: 4, originalName: "<img src=x>.pdf", size: 1000, uploadedAt: "2026-11-24T00:00:00Z" },
    ]);
    if (url === "/api/progress/courses/1") return Response.json({ lessons: [{ lessonId: 3, isCompleted: true }] });
    throw new Error(`Unexpected request: ${url}`);
  };
  const html = await lessonPage(parseRoute("#/lesson/3"), 1);
  assert.doesNotMatch(html, /javascript:|<script>|<img src=x/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&lt;img src=x&gt;\.pdf/);
  assert.match(html, /data-completed="true"/);
});

test("staff account screens request students even when the URL asks for Admin", async () => {
  state.user = { id: 20, role: "Staff" };
  globalThis.fetch = async (url) => {
    assert.equal(new URL(url, "http://localhost").searchParams.get("Role"), "User");
    return Response.json({
      items: [{ id: 30, fullName: "Sinh viên", email: "student@example.test", role: "User" }],
      totalCount: 1, pageNumber: 1, totalPages: 1,
    });
  };
  const html = await usersPage(parseRoute("#/users?role=Admin"), 1);
  assert.match(html, /data-action="reset-password"/);
  assert.doesNotMatch(html, /data-action="(?:create-user|delete-user|edit-role)"/);
});

test("concurrent page loads share catalog requests and clear private guest data", async () => {
  setToken(null);
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(url);
    return Response.json([]);
  };
  await Promise.all([loadData(), loadData()]);
  assert.deepEqual(calls.toSorted(), ["/api/categories", "/api/courses", "/api/lessons"]);
  assert.equal(state.ready, true);
  assert.deepEqual(state.enrollments, []);
  assert.deepEqual(state.progress, []);
});
