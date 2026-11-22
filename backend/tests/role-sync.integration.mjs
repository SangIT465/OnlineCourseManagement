import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { adminCredentials } from "./support/admin-credentials.mjs";
import { snapshot, sql } from "./support/sql-server.mjs";
import { canAccessPage, canCreateCourse, canManageCatalog, canManageCourse, canResetPassword, hasPermission } from "../../frontend/src/auth/permissions.js";

// Compare the actual FE permission helpers with HTTP decisions and SQL state.
const base = (process.env.COURSEFLOW_API_URL || "http://localhost:5106/api").replace(/\/+$/, "");
const tag = randomUUID().replaceAll("-", "");
const password = randomBytes(20).toString("base64url") + "A1!";
const created = { users: new Set(), categories: new Set(), courses: new Set(), lessons: new Set() };
const accounts = new Map();
let adminToken, studentToken, enrolledCourse, verified = false;
const before = snapshot();
let assertions = 0;
const check = (condition, label) => { assert.ok(condition, label); assertions++; };
const pass = label => console.log(`PASS ${label}`);

async function api(route, { token = adminToken, method = "GET", body, status = 200 } = {}) {
  const response = await fetch(base + route, {
    method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30000),
  });
  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  if (method === "POST" && response.ok && data?.id) created[route.slice(1)]?.add(data.id);
  assert.ok((Array.isArray(status) ? status : [status]).includes(response.status),
    `${method} ${route}: expected ${status}, received ${response.status}`);
  assertions++;
  return data;
}
const login = (email, value = password) => api("/auth/login", { token: null, method: "POST", body: { email, password: value } });
async function concurrently(operations) {
  const results = await Promise.allSettled(operations);
  for (const result of results) if (result.status === "rejected") throw result.reason;
  return results.map(result => result.value);
}

try {
  const credentials = await adminCredentials();
  adminToken = (await login(credentials.email, credentials.password)).token;
  for (const role of ["Admin", "Staff", "Instructor", "User"]) {
    const user = await api("/users", { method: "POST", status: 201,
      body: { fullName: `Role sync QA ${role} ${tag}`, email: `sync-${role.toLowerCase()}-${tag}@example.test`, password, role } });
    const signedIn = await login(user.email);
    accounts.set(role, { user: signedIn.user, token: signedIn.token });
    const row = sql(`SELECT Role FROM dbo.Users WHERE Id = ${user.id}`)[0];
    check(row.Role === role && signedIn.user.role === role, `${role}: FE profile, API and SQL role must match`);
  }
  const staff = accounts.get("Staff"), teacher = accounts.get("Instructor"), student = accounts.get("User");
  studentToken = student.token;
  const category = await api("/categories", { method: "POST", status: 201, body: { name: `Role sync QA ${tag}` } });
  const courseInput = { title: `Role sync QA ${tag}`, categoryId: category.id, price: 0 };
  const course = await api("/courses", { method: "POST", status: 201, body: courseInput });
  const foreign = await api("/courses", { method: "POST", status: 201, body: { ...courseInput, title: `Role sync foreign ${tag}` } });
  await api(`/courses/${course.id}/instructor`, { method: "PUT", body: { instructorId: teacher.user.id } });
  await api(`/courses/${course.id}/staff`, { method: "PUT", body: { staffId: staff.user.id } });
  let actualCourse = await api(`/courses/${course.id}`);
  check(actualCourse.instructorId === teacher.user.id && actualCourse.staffId === staff.user.id, "assignment is reflected in public course DTO");
  for (const field of ["instructorId", "staffId"])
    for (const body of [{}, { [field]: 0 }])
      await api(`/courses/${course.id}/${field === "staffId" ? "staff" : "instructor"}`, { method: "PUT", body, status: 400 });

  for (const [role, { user, token }] of accounts) {
    await api("/users?PageSize=1", { token, status: canAccessPage(user, "users") ? 200 : 403 });
    await api("/auth/admin-only", { token, status: hasPermission(user, "accounts.manage") ? 200 : 403 });
    await api("/enrollments", { token, status: canManageCatalog(user) ? 200 : 403 });
    await api("/enrollments/my", { token, status: hasPermission(user, "learning") ? 200 : 403 });
    await api(`/courses/${course.id}`, { token, method: "PUT", body: courseInput, status: canManageCourse(user, actualCourse) ? 200 : 403 });
    await api(`/courses/${foreign.id}`, { token, method: "PUT", body: courseInput, status: canManageCourse(user, foreign) ? 200 : 403 });
    const result = await api("/courses", { token, method: "POST", body: courseInput, status: canCreateCourse(user) ? 201 : 403 });
    if (canCreateCourse(user)) {
      check(result.instructorId === (role === "Instructor" ? user.id : null), `${role}: teaching owner must come from the authenticated role`);
      check(result.staffId === (role === "Staff" ? user.id : null), `${role}: staff owner must come from the authenticated role`);
    }
    pass(`${role}: FE navigation/actions agree with backend authorization`);
  }

  const lesson = await api("/lessons", { method: "POST", status: 201,
    body: { title: "Role sync lesson", content: "Learning consistency", courseId: course.id, orderIndex: 1, durationMinutes: 10 } });
  enrolledCourse = course.id;
  await api("/enrollments", { token: studentToken, method: "POST", status: 201, body: { courseId: course.id, studentId: teacher.user.id } });
  await api(`/progress/lessons/${lesson.id}/complete`, { token: studentToken, method: "POST" });
  const report = await api(`/progress/courses/${course.id}/students`, { token: teacher.token });
  check(report.students.some(item => item.studentId === student.user.id && item.percentage === 100), "teacher report must reflect real student progress");
  const progress = sql(`SELECT e.StudentId, e.CourseId, p.IsCompleted FROM dbo.Enrollments e JOIN dbo.LessonProgresses p ON p.EnrollmentId = e.Id WHERE e.StudentId = ${student.user.id} AND e.CourseId = ${course.id}`);
  check(progress.length === 1 && progress[0].IsCompleted === true, "student progress is saved in SQL for the authenticated student");
  pass("learning state agrees between API reports and SQL; incoming studentId cannot impersonate another account");

  for (const [role, { user, token }] of accounts) {
    if (role !== "Admin") {
      for (const field of ["instructorId", "staffId"])
        await api(`/courses/${course.id}/${field === "staffId" ? "staff" : "instructor"}`, { token, method: "PUT", body: { [field]: null }, status: 403 });
    }
    // Use a separate learner so testing password support does not invalidate a role fixture.
    check(canResetPassword(user, student.user) === ["Admin", "Staff"].includes(role), `${role}: frontend password support scope`);
  }
  await api(`/users/${teacher.user.id}/role`, { method: "PUT", body: { role: "User" }, status: 409 });
  await api(`/users/${staff.user.id}/role`, { method: "PUT", body: { role: "User" }, status: 409 });
  await api(`/courses/${course.id}/instructor`, { method: "PUT", body: { instructorId: null } });
  actualCourse = await api(`/courses/${course.id}`);
  check(actualCourse.instructorId === null && actualCourse.instructorName === null && actualCourse.staffId === staff.user.id,
    "clearing the instructor must preserve the independent staff assignment");
  await api(`/lessons/${lesson.id}`, { token: teacher.token, status: 403 });
  await api(`/progress/courses/${course.id}/students`, { token: teacher.token, status: 403 });
  check((await api("/courses/my", { token: teacher.token })).length === 1, "former instructor keeps only the separate course they created");
  await api(`/courses/${course.id}/staff`, { method: "PUT", body: { staffId: null } });
  const row = sql(`SELECT InstructorId, StaffId FROM dbo.Courses WHERE Id = ${course.id}`)[0];
  check(Object.keys(row).length === 0, "SQL must contain NULL for both cleared assignments");
  await api(`/users/${teacher.user.id}/role`, { method: "PUT", body: { role: "User" }, status: 409 });
  // Their self-created teaching course still has to be released before changing role.
  const owned = await api("/courses/my", { token: teacher.token });
  for (const item of owned) await api(`/courses/${item.id}/instructor`, { method: "PUT", body: { instructorId: null } });
  await api(`/users/${teacher.user.id}/role`, { method: "PUT", body: { role: "User" } });
  await api("/auth/me", { token: teacher.token, status: 401 });
  const staffOwned = await api("/courses/my", { token: staff.token });
  for (const item of staffOwned) await api(`/courses/${item.id}/staff`, { method: "PUT", body: { staffId: null } });
  await api(`/users/${staff.user.id}/role`, { method: "PUT", body: { role: "User" } });
  await api("/auth/me", { token: staff.token, status: 401 });
  pass("only Admin can clear assignments; SQL NULLs, immediate ownership loss and guarded role changes stay synchronized");

  for (const [role, account, field, endpoint] of [
    ["Instructor", teacher, "InstructorId", "instructor"],
    ["Staff", staff, "StaffId", "staff"],
  ]) {
    for (let round = 0; round < 4; round++) {
      await api(`/users/${account.user.id}/role`, { method: "PUT", body: { role } });
      await concurrently([
        api(`/users/${account.user.id}/role`, { method: "PUT", body: { role: "User" }, status: [200, 409] }),
        api(`/courses/${course.id}/${endpoint}`, { method: "PUT", body: { [endpoint + "Id"]: account.user.id }, status: [200, 400, 409] }),
      ]);
      const result = sql(`SELECT u.Role, c.${field} AS AssignedId FROM dbo.Users u CROSS JOIN dbo.Courses c WHERE u.Id = ${account.user.id} AND c.Id = ${course.id}`)[0];
      check(result.AssignedId == null || result.Role === role, `${role}: parallel assignment/role change must preserve SQL role integrity`);
      await api(`/courses/${course.id}/${endpoint}`, { method: "PUT", body: { [endpoint + "Id"]: null } });
      await api(`/users/${account.user.id}/role`, { method: "PUT", body: { role: "User" } });
    }
  }
  pass("parallel assignment and role changes preserve Instructor/Staff relationships in SQL (8 rounds)");
  for (const [role, account, endpoint] of [["Instructor", teacher, "instructor"], ["Staff", staff, "staff"]]) {
    for (let round = 0; round < 2; round++) {
      await api(`/users/${account.user.id}/role`, { method: "PUT", body: { role } });
      const token = (await login(account.user.email)).token;
      const [result] = await concurrently([
        api("/courses", { token, method: "POST", body: courseInput, status: [201, 401, 409] }),
        api(`/users/${account.user.id}/role`, { method: "PUT", body: { role: "User" }, status: [200, 409] }),
      ]);
      const invalid = sql(`SELECT COUNT(*) AS Total FROM dbo.Courses c JOIN dbo.Users u ON u.Id = c.${endpoint === "staff" ? "StaffId" : "InstructorId"} WHERE u.Id = ${account.user.id} AND u.Role <> N'${role}'`)[0].Total;
      check(invalid === 0, `${role}: concurrent self-assigned course creation cannot leave an invalid assignment`);
      if (result?.id) await api(`/courses/${result.id}/${endpoint}`, { method: "PUT", body: { [endpoint + "Id"]: null } });
      await api(`/users/${account.user.id}/role`, { method: "PUT", body: { role: "User" } });
    }
  }
  pass("concurrent course creation and role changes preserve automatic ownership (4 rounds)");
  verified = true;
} finally {
  if (adminToken) {
    const cleanup = async (route, status = 200, token = adminToken) => {
      try { await api(route, { token, method: "DELETE", status }); }
      catch (error) { console.error(`Cleanup failed: ${error.message}`); process.exitCode = 1; }
    };
    if (enrolledCourse && studentToken) {
      const mine = await api("/enrollments/my", { token: studentToken });
      if (mine.some(item => item.courseId === enrolledCourse)) await cleanup(`/enrollments/${enrolledCourse}`, 200, studentToken);
    }
    for (const resource of ["lessons", "courses", "categories", "users"])
      for (const id of created[resource]) await cleanup(`/${resource}/${id}`, resource === "categories" ? 204 : 200);
  }
  assert.deepEqual(snapshot(), before, "Role synchronization tests must preserve original SQL records");
  pass(`QA records removed and original SQL checksums unchanged`);
  if (verified) pass(`role synchronization suite completed (${assertions} HTTP/assertion checks)`);
}
