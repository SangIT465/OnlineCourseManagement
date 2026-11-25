import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { adminCredentials } from "../backend/tests/support/admin-credentials.mjs";

const base = (process.env.COURSEFLOW_API_URL || "http://localhost:5106/api").replace(/\/+$/, "");
const seed = JSON.parse(await readFile(new URL("../database/seeds/banking-test-courses.json", import.meta.url), "utf8"));
assert.equal(seed.courses.length, 6);
assert.equal(seed.courses.filter(course => course.price === 10000).length, 3);
assert.equal(seed.courses.filter(course => course.price === 5).length, 3);
let token;
const report = { api: base, createdAt: new Date().toISOString(), createdCourses: [], createdLessons: [], courses: [] };
async function api(route, { method = "GET", body, expected = 200 } = {}) {
  const response = await fetch(base + route, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30000),
  });
  assert.equal(response.status, expected, `${method} ${route}: expected ${expected}, received ${response.status}`);
  return response.status === 204 ? null : response.json();
}
const sameName = (a, b) => a.trim().toLocaleLowerCase("vi") === b.trim().toLocaleLowerCase("vi");

try {
  token = (await api("/auth/login", { method: "POST", body: await adminCredentials() })).token;
  const categories = await api("/categories");
  let category = categories.find(item => sameName(item.name, seed.category.name));
  const existing = await api("/courses");
  // Preserve previously edited data instead of silently changing an existing course's price.
  for (const input of seed.courses) {
    const found = existing.find(item => item.categoryId === category?.id && sameName(item.title, input.title));
    if (found) assert.equal(found.price, input.price, `Existing course ${found.id} has a different price; no data was overwritten.`);
  }
  if (!category) category = await api("/categories", { method: "POST", body: seed.category, expected: 201 });
  report.categoryId = category.id;
  for (const input of seed.courses) {
    let course = existing.find(item => item.categoryId === category.id && sameName(item.title, input.title));
    if (!course) {
      course = await api("/courses", { method: "POST", expected: 201,
        body: { title: input.title, description: input.description, price: input.price, categoryId: category.id } });
      report.createdCourses.push(course.id);
    }
    const lessons = await api(`/lessons/course/${course.id}`);
    let lesson = lessons.find(item => item.orderIndex === 1);
    if (!lesson) {
      lesson = await api("/lessons", { method: "POST", expected: 201,
        body: { ...input.lesson, courseId: course.id, orderIndex: 1 } });
      report.createdLessons.push(lesson.id);
    }
    const saved = await api(`/courses/${course.id}`);
    assert.equal(saved.price, input.price);
    assert.equal(saved.title, input.title);
    report.courses.push({ id: saved.id, title: saved.title, price: saved.price, categoryId: saved.categoryId, lessonId: lesson.id });
    console.log(`OK #${saved.id} | ${saved.price} VND | ${saved.title}`);
  }
  console.log(`Done: ${report.createdCourses.length} new courses, ${report.createdLessons.length} new lessons. Existing data preserved.`);
} finally {
  const out = new URL("../artifacts/", import.meta.url);
  await mkdir(out, { recursive: true });
  await writeFile(new URL("banking-courses-seed.json", out), JSON.stringify(report, null, 2) + "\n");
}
