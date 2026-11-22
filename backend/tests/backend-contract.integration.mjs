import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { adminCredentials } from "./support/admin-credentials.mjs";

const base = (process.env.COURSEFLOW_API_URL || "http://localhost:5106/api").replace(/\/+$/, "");
const origin = new URL(base).origin;
const suffix = Date.now().toString(36);
const created = { users: new Set(), categories: new Set(), courses: new Set(), lessons: new Set(), files: new Set() };
let adminToken, studentToken, enrolledCourse;
const pass = message => console.log(`PASS ${message}`);

async function api(route, { token = adminToken, method = "GET", body, status = 200, headers = {} } = {}) {
  const multipart = body instanceof FormData;
  const response = await fetch(base + route, {
    method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined && !multipart ? { "Content-Type": "application/json" } : {}), ...headers },
    body: body === undefined ? undefined : multipart ? body : JSON.stringify(body), signal: AbortSignal.timeout(45000),
  });
  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  if (method === "POST" && response.ok && data?.id) {
    const group = route === "/auth/register" ? "users" : route.startsWith("/files/") ? "files" : route.slice(1);
    created[group]?.add(data.id);
  }
  assert.equal(response.status, status, `${method} ${route}: expected ${status}, got ${response.status}`);
  return { data, headers: response.headers };
}

try {
  adminToken = (await api("/auth/login", { token: null, method: "POST", body: await adminCredentials() })).data.token;
  const trace = `contract-${suffix}`;
  const missing = await api("/courses/2147483647", { status: 404, headers: { "X-Request-ID": trace } });
  assert.equal(missing.data.status, 404);
  assert.equal(missing.data.traceId, trace);
  assert.equal(missing.headers.get("x-request-id"), trace);
  assert.ok(missing.headers.get("content-type").startsWith("application/problem+json"));
  const unsafeTrace = await api("/nonexistent", { token: null, status: 404, headers: { "X-Request-ID": "invalid id with spaces" } });
  assert.match(unsafeTrace.data.traceId, /^[a-f0-9]{32}$/);
  await api("/users", { token: null, status: 401 });
  pass("business and routing errors are ProblemDetails with safe request IDs; unauthenticated calls are rejected");

  for (const query of ["MinPrice=20&MaxPrice=10", "SortBy=passwordHash", "PageNumber=invalid"])
    assert.ok((await api(`/courses/paged?${query}`, { token: null, status: 400 })).data.errors);
  const first = (await api("/courses/paged?PageNumber=1&PageSize=3&SortBy=price&IsDescending=false", { token: null })).data;
  const second = (await api("/courses/paged?PageNumber=2&PageSize=3&SortBy=price&IsDescending=false", { token: null })).data;
  assert.equal(first.items.length, 3);
  assert.ok(first.items.every((item, index) => index === 0 || first.items[index - 1].price <= item.price));
  assert.ok(second.items.every(item => !first.items.some(previous => previous.id === item.id)));
  assert.equal(first.totalCount, (await api("/courses", { token: null })).data.length);
  const bounded = (await api("/courses/paged?PageSize=9999", { token: null })).data;
  assert.equal(bounded.pageSize, 100);
  const metadata = (await api("/lessons/paged?PageSize=3", { token: null })).data;
  assert.ok(metadata.items.every(item => !Object.hasOwn(item, "content") && !Object.hasOwn(item, "videoUrl")));
  pass("pagination/filtering/sorting are bounded, deterministic and do not expose lesson content");

  const preflight = await fetch(base + "/courses/1", { method: "OPTIONS", headers: {
    Origin: "http://localhost:5173", "Access-Control-Request-Method": "PUT", "Access-Control-Request-Headers": "authorization,content-type"
  } });
  assert.equal(preflight.headers.get("access-control-allow-origin"), "http://localhost:5173");
  const deniedOrigin = await fetch(base + "/courses", { headers: { Origin: "https://untrusted.example.test" } });
  assert.equal(deniedOrigin.headers.get("access-control-allow-origin"), null);
  const swaggerResponse = await fetch(origin + "/swagger/v1/swagger.json");
  assert.equal(swaggerResponse.status, 200);
  const swagger = await swaggerResponse.json();
  assert.ok(swagger.paths["/api/courses/paged"].get.parameters.some(parameter => parameter.name === "PageSize"));
  assert.deepEqual(swagger.paths["/api/auth/login"].post.security, []);
  assert.ok(swagger.components.securitySchemes.Bearer);
  assert.ok(swagger.paths["/api/courses"].post.responses["403"]);
  assert.equal((await fetch(origin + "/health")).status, 200);
  assert.equal((await fetch(origin + "/health/ready")).status, 200);
  pass("CORS, documented public/authenticated Swagger operations and liveness/readiness endpoints work");

  const category = (await api("/categories", { method: "POST", status: 201, body: { id: 2147483000, name: `Contract QA ${suffix}` } })).data;
  assert.notEqual(category.id, 2147483000);
  await api("/categories", { method: "POST", status: 409, body: { name: ` Contract QA ${suffix} ` } });
  const courseInput = { title: `Contract QA ${suffix}`, price: 0, categoryId: category.id };
  const course = (await api("/courses", { method: "POST", status: 201, body: courseInput })).data;
  const destination = (await api("/courses", { method: "POST", status: 201, body: { ...courseInput, title: `Contract QA target ${suffix}` } })).data;
  await api("/courses", { method: "POST", status: 400, body: { ...courseInput, price: 1e20 } });
  const lessonInput = { title: "Contract QA lesson", courseId: course.id, orderIndex: 1, durationMinutes: 20 };
  await api("/lessons", { method: "POST", status: 400, body: { ...lessonInput, videoUrl: "javascript:alert(1)" } });
  const lesson = (await api("/lessons", { method: "POST", status: 201, body: lessonInput })).data;
  await api("/lessons", { method: "POST", status: 409, body: lessonInput });
  pass("DTOs prevent overposting, invalid prices/URLs and duplicate category/lesson order values");

  const password = randomBytes(18).toString("base64url") + "A1!";
  const student = (await api("/auth/register", { method: "POST", token: null, body: { fullName: "Contract QA learner", email: `contract-qa-${suffix}@example.test`, password } })).data;
  studentToken = (await api("/auth/login", { method: "POST", token: null, body: { email: student.email, password } })).data.token;
  const payload = JSON.parse(Buffer.from(studentToken.split(".")[1], "base64url"));
  assert.deepEqual(payload.permission, "learning");
  enrolledCourse = course.id;
  await api("/enrollments", { token: studentToken, method: "POST", status: 201, body: { courseId: course.id } });
  await api(`/progress/lessons/${lesson.id}/complete`, { token: studentToken, method: "POST" });
  await api(`/lessons/${lesson.id}`, { method: "PUT", status: 409, body: { ...lessonInput, courseId: destination.id } });
  const pdf = new FormData();
  pdf.set("file", new Blob(["%PDF-1.4\n%%EOF"]), "contract.pdf");
  const file = (await api(`/files/lessons/${lesson.id}/document`, { method: "POST", status: 201, body: pdf })).data;
  await api(`/lessons/${lesson.id}`, { method: "DELETE", status: 409 });
  await api(`/files/${file.id}`, { method: "DELETE" }); created.files.delete(file.id);
  await api(`/lessons/${lesson.id}`, { method: "DELETE" }); created.lessons.delete(lesson.id);
  const progress = (await api(`/progress/courses/${course.id}`, { token: studentToken })).data;
  assert.equal(progress.totalLessons, 0);
  assert.equal(progress.completedLessons, 0);
  assert.equal(progress.percentage, 0);
  pass("moving in-use lessons is blocked; deleting a lesson removes related progress atomically after documents are removed");
} finally {
  if (adminToken) {
    const cleanup = async (route, status = 200, token = adminToken) => {
      try { await api(route, { method: "DELETE", token, status }); }
      catch (error) { console.error(`Cleanup failed: ${error.message}`); process.exitCode = 1; }
    };
    if (enrolledCourse && studentToken) {
      const mine = (await api("/enrollments/my", { token: studentToken })).data;
      if (mine.some(enrollment => enrollment.courseId === enrolledCourse))
        await cleanup(`/enrollments/${enrolledCourse}`, 200, studentToken);
    }
    for (const resource of ["files", "lessons", "courses", "categories", "users"])
      for (const id of created[resource]) await cleanup(`/${resource}/${id}`, resource === "categories" ? 204 : 200);
    console.log(process.exitCode ? "Backend-contract QA cleanup needs attention." : "Temporary backend-contract QA records cleaned up.");
  }
}
