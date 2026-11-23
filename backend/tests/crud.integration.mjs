import assert from "node:assert/strict";
import { adminCredentials as credentials } from "./support/admin-credentials.mjs";
import { snapshot, sql } from "./support/sql-server.mjs";

// Run explicitly against the local development API and its SQL Server database.
// Only records created by this run are changed or deleted.
const base = (process.env.COURSEFLOW_API_URL || "http://localhost:5106/api").replace(/\/+$/, "");
const suffix = Date.now().toString(36);
const created = { categories: new Set(), courses: new Set(), lessons: new Set() };
let token;

async function api(route, { method = "GET", body, status = 200 } = {}) {
  const response = await fetch(base + route, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  if (method === "POST" && response.ok && data?.id && created[route.slice(1)])
    created[route.slice(1)].add(data.id);
  assert.equal(response.status, status, `${method} ${route}: expected ${status}, got ${response.status}`);
  return data;
}

const pass = message => console.log(`PASS ${message}`);
const before = snapshot();
console.log("Existing SQL data:", JSON.stringify(before.map(({ TableName, Total }) => ({ table: TableName, total: Total }))));

try {
  token = (await api("/auth/login", { method: "POST", body: await credentials() })).token;
  assert.ok(token);

  const categoryBody = { name: `CRUD QA Danh mục ${suffix}`, description: "Kiểm tra dữ liệu tiếng Việt" };
  const category = await api("/categories", { method: "POST", status: 201, body: categoryBody });
  assert.deepEqual(sql(`SELECT Name, Description FROM dbo.Categories WHERE Id = ${category.id}`), [{ Name: categoryBody.name, Description: categoryBody.description }]);
  assert.equal((await api(`/categories/${category.id}`)).name, categoryBody.name);
  const updatedCategory = { name: `CRUD QA Danh mục đã sửa ${suffix}`, description: "Mô tả đã cập nhật" };
  await api(`/categories/${category.id}`, { method: "PUT", body: updatedCategory, status: 204 });
  assert.deepEqual(sql(`SELECT Name, Description FROM dbo.Categories WHERE Id = ${category.id}`), [{ Name: updatedCategory.name, Description: updatedCategory.description }]);
  assert.equal((await api(`/categories/${category.id}`)).name, updatedCategory.name);
  pass("Category create/read/update persisted in SQL Server, including Vietnamese text");

  const courseBody = { title: `CRUD QA Khóa học ${suffix}`, description: "Mô tả khóa học mới", price: 120000, categoryId: category.id };
  const course = await api("/courses", { method: "POST", body: courseBody, status: 201 });
  assert.deepEqual(sql(`SELECT Title, Description, Price, CategoryId FROM dbo.Courses WHERE Id = ${course.id}`), [{ Title: courseBody.title, Description: courseBody.description, Price: courseBody.price, CategoryId: category.id }]);
  assert.equal((await api(`/courses/${course.id}`)).title, courseBody.title);
  const updatedCourse = { ...courseBody, title: `CRUD QA Khóa học đã sửa ${suffix}`, description: "Nội dung giới thiệu đã cập nhật", price: 199000.5 };
  await api(`/courses/${course.id}`, { method: "PUT", body: updatedCourse });
  const savedCourse = await api(`/courses/${course.id}`);
  assert.equal(savedCourse.price, updatedCourse.price);
  assert.equal(savedCourse.title, updatedCourse.title);
  assert.deepEqual(sql(`SELECT Title, Description, Price, CategoryId FROM dbo.Courses WHERE Id = ${course.id}`), [{ Title: updatedCourse.title, Description: updatedCourse.description, Price: updatedCourse.price, CategoryId: category.id }]);
  pass("Course create/read/update persisted in SQL Server, including decimal prices");

  const lessonBody = { title: `CRUD QA Bài học ${suffix}`, content: "Nội dung bài học mới", durationMinutes: 20, orderIndex: 1, courseId: course.id };
  const lesson = await api("/lessons", { method: "POST", body: lessonBody, status: 201 });
  assert.equal(sql(`SELECT Title, Content FROM dbo.Lessons WHERE Id = ${lesson.id}`)[0].Content, lessonBody.content);
  assert.equal((await api(`/lessons/${lesson.id}`)).title, lessonBody.title);
  const updatedLesson = { ...lessonBody, title: `CRUD QA Bài học đã sửa ${suffix}`, content: "Nội dung tiếng Việt đã sửa và lưu thật trong SQL Server.", durationMinutes: 45, orderIndex: 2 };
  await api(`/lessons/${lesson.id}`, { method: "PUT", body: updatedLesson });
  assert.equal((await api(`/lessons/${lesson.id}`)).content, updatedLesson.content);
  assert.deepEqual(sql(`SELECT Title, Content, DurationMinutes, OrderIndex, CourseId FROM dbo.Lessons WHERE Id = ${lesson.id}`), [{ Title: updatedLesson.title, Content: updatedLesson.content, DurationMinutes: 45, OrderIndex: 2, CourseId: course.id }]);
  pass("Lesson create/read/update persisted in SQL Server");

  await api(`/categories/${category.id}`, { method: "DELETE", status: 409 });
  await api(`/courses/${course.id}`, { method: "DELETE", status: 409 });
  assert.equal(sql(`SELECT COUNT(*) AS Total FROM dbo.Courses WHERE Id = ${course.id}`)[0].Total, 1);
  assert.equal(sql(`SELECT COUNT(*) AS Total FROM dbo.Lessons WHERE Id = ${lesson.id}`)[0].Total, 1);
  pass("Deletion blocked for category containing courses and course containing lessons (HTTP 409)");

  await api(`/lessons/${lesson.id}`, { method: "DELETE" });
  created.lessons.delete(lesson.id);
  await api(`/lessons/${lesson.id}`, { status: 404 });
  assert.equal(sql(`SELECT COUNT(*) AS Total FROM dbo.Lessons WHERE Id = ${lesson.id}`)[0].Total, 0);
  await api(`/courses/${course.id}`, { method: "DELETE" });
  created.courses.delete(course.id);
  await api(`/courses/${course.id}`, { status: 404 });
  assert.equal(sql(`SELECT COUNT(*) AS Total FROM dbo.Courses WHERE Id = ${course.id}`)[0].Total, 0);
  await api(`/categories/${category.id}`, { method: "DELETE", status: 204 });
  created.categories.delete(category.id);
  await api(`/categories/${category.id}`, { status: 404 });
  assert.equal(sql(`SELECT COUNT(*) AS Total FROM dbo.Categories WHERE Id = ${category.id}`)[0].Total, 0);
  pass("Lesson/course/category deletion confirmed independently through API and SQL Server");
} finally {
  if (token) {
    for (const resource of ["lessons", "courses", "categories"])
      for (const id of created[resource]) {
        try { await api(`/${resource}/${id}`, { method: "DELETE", status: resource === "categories" ? 204 : 200 }); }
        catch (error) { console.error(`Cleanup failed: ${error.message}`); process.exitCode = 1; }
      }
  }
  const after = snapshot();
  assert.deepEqual(after, before, "Existing records must remain unchanged after temporary CRUD tests");
  pass("Temporary QA records removed; original row counts and database checksums unchanged");
}
