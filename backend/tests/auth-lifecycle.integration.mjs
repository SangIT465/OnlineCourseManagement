import assert from "node:assert/strict";
import { pbkdf2Sync, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { adminCredentials } from "./support/admin-credentials.mjs";
import { snapshot, sql } from "./support/sql-server.mjs";

const base = (process.env.COURSEFLOW_API_URL || "http://localhost:5106/api").replace(/\/+$/, "");
const suffix = randomUUID().replaceAll("-", "");
const email = `auth-qa-${suffix}@example.test`;
const password = ` ${randomBytes(18).toString("base64url")}A1! `;
const created = { users: new Set(), categories: new Set(), courses: new Set(), lessons: new Set() };
const enrollments = new Map();
let adminToken;
const pass = message => console.log(`PASS ${message}`);

async function api(route, { token, method = "GET", body, status = 200 } = {}) {
  const response = await fetch(base + route, {
    method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30000),
  });
  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  if (method === "POST" && response.ok && data?.id)
    created[route === "/auth/register" ? "users" : route.slice(1)]?.add(data.id);
  if (status !== null) assert.equal(response.status, status, `${method} ${route}: unexpected HTTP status`);
  return { data, status: response.status };
}
const login = (address = email, value = password) => api("/auth/login", {
  method: "POST", body: { email: address, password: value },
});

function verifiesIdentityHash(encoded, value) {
  const bytes = Buffer.from(encoded, "base64");
  if (bytes[0] !== 1 || bytes.length < 14) return false;
  const algorithm = ["sha1", "sha256", "sha512"][bytes.readUInt32BE(1)];
  const iterations = bytes.readUInt32BE(5), saltSize = bytes.readUInt32BE(9);
  if (!algorithm || saltSize < 16 || bytes.length <= 13 + saltSize) return false;
  const expected = bytes.subarray(13 + saltSize);
  const actual = pbkdf2Sync(value, bytes.subarray(13, 13 + saltSize), iterations, expected.length, algorithm);
  return timingSafeEqual(expected, actual);
}

const before = snapshot();
try {
  adminToken = (await api("/auth/login", { method: "POST", body: await adminCredentials() })).data.token;
  const input = { fullName: "  Auth QA learner  ", email: email.toUpperCase(), password };
  for (const patch of [
    { fullName: "   " }, { email: "not-an-email" }, { password: "short" }, { password: "        " },
    { password: null }, { role: "Admin" }, { role: "Staff" }, { role: "Instructor" }, { role: "Student" }, { role: null },
  ]) await api("/auth/register", { method: "POST", body: { ...input, ...patch }, status: 400 });
  assert.equal(sql(`SELECT COUNT(*) AS Total FROM dbo.Users WHERE Email = N'${email}'`)[0].Total, 0);
  pass("invalid registration and privileged roles create no SQL accounts");

  const registered = (await api("/auth/register", { method: "POST", body: {
    ...input, id: 2147483647, passwordHash: "untrusted", securityStamp: "untrusted", role: " user ",
  } })).data;
  assert.equal(registered.email, email);
  assert.equal(registered.fullName, "Auth QA learner");
  assert.equal(registered.role, "User");
  assert.notEqual(registered.id, 2147483647);
  const stored = sql(`SELECT FullName, Email, Role, PasswordHash FROM dbo.Users WHERE Id = ${registered.id}`)[0];
  assert.equal(stored.Email, email);
  assert.equal(stored.Role, "User");
  assert.ok(verifiesIdentityHash(stored.PasswordHash, password), "SQL must store a valid salted password hash");
  assert.ok(stored.PasswordHash !== password, "SQL must not store the plaintext password");
  for (const key of ["password", "passwordHash", "securityStamp"])
    assert.equal(Object.hasOwn(registered, key), false);
  await api("/auth/register", { method: "POST", body: input, status: 409 });
  pass("registration normalizes email/name, ignores injected fields and persists a salted hash; duplicate email is rejected");

  const signedIn = (await login(email.toUpperCase())).data;
  let token = signedIn.token;
  assert.equal(signedIn.user.id, registered.id);
  assert.equal((await api("/auth/me", { token })).data.id, registered.id);
  const wrong = (await api("/auth/login", { method: "POST", body: { email, password: password.trim() }, status: 401 })).data;
  const missing = (await api("/auth/login", { method: "POST", body: { email: `missing-${email}`, password }, status: 401 })).data;
  assert.equal(wrong.message, missing.message);
  await api("/auth/me", { status: 401 });
  const parts = token.split(".");
  const claims = JSON.parse(Buffer.from(parts[1], "base64url"));
  claims.role = "Admin";
  parts[1] = Buffer.from(JSON.stringify(claims)).toString("base64url");
  await api("/auth/me", { token: parts.join("."), status: 401 });
  for (const key of ["password", "passwordHash", "securityStamp"])
    assert.equal(Object.hasOwn(signedIn.user, key), false);
  pass("login preserves password spaces, hides account existence/private fields and rejects missing or modified JWTs");

  const concurrentEmail = `race-${email}`;
  const simultaneous = await Promise.all(Array.from({ length: 2 }, () => api("/auth/register", {
    method: "POST", body: { ...input, email: concurrentEmail }, status: null,
  })));
  assert.deepEqual(simultaneous.map(result => result.status).sort(), [200, 409]);
  assert.equal(sql(`SELECT COUNT(*) AS Total FROM dbo.Users WHERE Email = N'${concurrentEmail}'`)[0].Total, 1);
  pass("simultaneous registration of the same email creates exactly one SQL account");

  const category = (await api("/categories", { token: adminToken, method: "POST", status: 201, body: { name: `Auth QA ${suffix}` } })).data;
  const course = (await api("/courses", { token: adminToken, method: "POST", status: 201,
    body: { title: `Auth QA ${suffix}`, categoryId: category.id, price: 0 } })).data;
  const lesson = (await api("/lessons", { token: adminToken, method: "POST", status: 201,
    body: { title: "Lifecycle lesson", courseId: course.id, orderIndex: 1, durationMinutes: 10 } })).data;
  await api(`/lessons/${lesson.id}`, { token, status: 403 });
  await api(`/progress/lessons/${lesson.id}/complete`, { token, method: "POST", status: 403 });
  const enrollment = (await api("/enrollments", { token, method: "POST", status: 201, body: { courseId: course.id, studentId: 1 } })).data;
  enrollments.set(course.id, { email, password });
  assert.equal(enrollment.studentId, registered.id);
  await api("/enrollments", { token, method: "POST", status: 409, body: { courseId: course.id } });
  const firstComplete = (await api(`/progress/lessons/${lesson.id}/complete`, { token, method: "POST" })).data;
  const repeated = (await api(`/progress/lessons/${lesson.id}/complete`, { token, method: "POST" })).data;
  assert.equal(repeated.completedAt, firstComplete.completedAt);
  assert.equal((await api(`/progress/courses/${course.id}`, { token })).data.percentage, 100);
  await api(`/progress/lessons/${lesson.id}/complete`, { token, method: "DELETE" });
  assert.equal((await api(`/progress/courses/${course.id}`, { token })).data.percentage, 0);
  await api(`/progress/lessons/${lesson.id}/complete`, { token, method: "POST" });
  await api(`/enrollments/${course.id}`, { token, method: "DELETE" });
  enrollments.delete(course.id);
  assert.equal(sql(`SELECT COUNT(*) AS Total FROM dbo.LessonProgresses WHERE EnrollmentId = ${enrollment.id}`)[0].Total, 0);
  await api(`/lessons/${lesson.id}`, { token, status: 403 });
  await api(`/progress/lessons/${lesson.id}/complete`, { token, method: "POST", status: 403 });
  const reenrolled = (await api("/enrollments", { token, method: "POST", status: 201, body: { courseId: course.id } })).data;
  enrollments.set(course.id, { email, password });
  assert.notEqual(reenrolled.id, enrollment.id);
  assert.equal((await api(`/progress/courses/${course.id}`, { token })).data.completedLessons, 0);
  pass("enrollment cannot impersonate another student; progress is repeatable, undoable and removed on cancellation/re-enrollment");

  const nextPassword = randomBytes(18).toString("base64url") + "B2!";
  await api(`/users/${registered.id}/reset-password`, { token: adminToken, method: "PUT", body: { newPassword: nextPassword } });
  enrollments.set(course.id, { email, password: nextPassword });
  await api("/auth/me", { token, status: 401 });
  await api("/auth/login", { method: "POST", body: { email, password }, status: 401 });
  token = (await login(email, nextPassword)).data.token;
  assert.equal((await api("/auth/me", { token })).data.id, registered.id);
  assert.ok(verifiesIdentityHash(sql(`SELECT PasswordHash FROM dbo.Users WHERE Id = ${registered.id}`)[0].PasswordHash, nextPassword));
  pass("password reset persists the replacement hash and immediately revokes the old password/session");
} finally {
  if (adminToken) {
    const cleanup = async (route, token = adminToken, status = 200) => {
      try { await api(route, { token, method: "DELETE", status }); }
      catch (error) { console.error(`Cleanup failed: ${error.message}`); process.exitCode = 1; }
    };
    for (const [courseId, credentials] of enrollments) {
      try { await cleanup(`/enrollments/${courseId}`, (await login(credentials.email, credentials.password)).data.token); }
      catch (error) { console.error(`Enrollment cleanup failed: ${error.message}`); process.exitCode = 1; }
    }
    for (const resource of ["lessons", "courses", "categories", "users"])
      for (const id of created[resource]) await cleanup(`/${resource}/${id}`, adminToken, resource === "categories" ? 204 : 200);
  }
  assert.deepEqual(snapshot(), before, "Account/lifecycle tests must preserve original SQL records");
  pass("all temporary records removed; original SQL counts and checksums unchanged");
}
