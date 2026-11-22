import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

// Run explicitly against a local development API. Only temporary QA records are modified.
const base = (
  process.env.COURSEFLOW_API_URL || "http://localhost:5106/api"
).replace(/\/+$/, "");
const suffix = Date.now().toString(36);
const password = randomBytes(18).toString("base64url") + "A1!";
let userPassword = password;
const created = {
  users: new Set(),
  courses: new Set(),
  lessons: new Set(),
  categories: new Set(),
  files: new Set(),
};
let adminToken,
  staffToken,
  userToken,
  otherToken,
  userAccount,
  course,
  enrolled = false;

async function credentials() {
  if (
    process.env.COURSEFLOW_TEST_ADMIN_EMAIL &&
    process.env.COURSEFLOW_TEST_ADMIN_PASSWORD
  )
    return {
      email: process.env.COURSEFLOW_TEST_ADMIN_EMAIL,
      password: process.env.COURSEFLOW_TEST_ADMIN_PASSWORD,
    };
  const id = "57665c0f-8f02-41c2-8d81-b48d6e592b4e";
  const file = process.env.APPDATA
    ? path.join(
        process.env.APPDATA,
        "Microsoft",
        "UserSecrets",
        id,
        "secrets.json",
      )
    : path.join(os.homedir(), ".microsoft", "usersecrets", id, "secrets.json");
  const secrets = JSON.parse(
    (await readFile(file, "utf8")).replace(/^\uFEFF/, ""),
  );
  const result = {
    email: secrets["AdminSeed:Email"],
    password: secrets["AdminSeed:Password"],
  };
  if (!result.email || !result.password)
    throw new Error(
      "Configure a development Admin through environment variables or User Secrets.",
    );
  return result;
}

async function call(
  route,
  { token, method = "GET", body, status = 200, binary = false } = {},
) {
  const multipart = body instanceof FormData;
  const response = await fetch(base + route, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined && !multipart
        ? { "Content-Type": "application/json" }
        : {}),
    },
    body:
      body === undefined ? undefined : multipart ? body : JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const raw = binary ? await response.arrayBuffer() : await response.text();
  let data = raw;
  if (!binary) {
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {}
  }
  if (method === "POST" && response.ok && data?.id) {
    const group =
      route === "/auth/register" || route === "/users"
        ? "users"
        : route === "/courses"
          ? "courses"
          : route === "/lessons"
            ? "lessons"
            : route === "/categories"
              ? "categories"
              : route.startsWith("/files/")
                ? "files"
                : null;
    if (group) created[group].add(data.id);
  }
  assert.equal(
    response.status,
    status,
    `${method} ${route}: expected ${status}, received ${response.status}`,
  );
  return data;
}
const login = (email, loginPassword = password) =>
  call("/auth/login", {
    method: "POST",
    body: { email, password: loginPassword },
  });
const account = (name, role) =>
  call("/users", {
    token: adminToken,
    method: "POST",
    status: 201,
    body: {
      fullName: `RBAC QA ${name} ${suffix}`,
      email: `rbac-${name}-${suffix}@example.test`,
      password,
      role,
    },
  });
const pass = (message) => console.log(`PASS ${message}`);

try {
  const admin = await login(
    (await credentials()).email,
    (await credentials()).password,
  );
  adminToken = admin.token;
  for (const role of ["Admin", "Staff", "Student", "Instructor"]) {
    await call("/auth/register", {
      method: "POST",
      status: 400,
      body: {
        fullName: "RBAC QA rejected",
        email: `rbac-rejected-${role}-${suffix}@example.test`,
        password,
        role,
      },
    });
  }
  userAccount = await call("/auth/register", {
    method: "POST",
    body: {
      fullName: `RBAC QA User ${suffix}`,
      email: `rbac-user-${suffix}@example.test`,
      password,
    },
  });
  assert.equal(userAccount.role, "User");
  userToken = (await login(userAccount.email)).token;
  const staff = await account("staff", "Staff"),
    other = await account("other", "User"),
    qaAdmin = await account("admin", "Admin");
  staffToken = (await login(staff.email)).token;
  otherToken = (await login(other.email)).token;
  const qaAdminToken = (await login(qaAdmin.email)).token;
  pass(
    "registration cannot grant privileged or retired roles; Admin creates supported roles",
  );

  const category = await call("/categories", {
    token: staffToken,
    method: "POST",
    status: 201,
    body: {
      name: `RBAC QA ${suffix}`,
      description: "Temporary authorization integration data",
    },
  });
  course = await call("/courses", {
    token: staffToken,
    method: "POST",
    status: 201,
    body: {
      title: `RBAC QA course ${suffix}`,
      description: "Temporary course",
      price: 0,
      categoryId: category.id,
    },
  });
  const lesson = await call("/lessons", {
    token: staffToken,
    method: "POST",
    status: 201,
    body: {
      title: "RBAC QA lesson",
      content: "Authorization practice",
      durationMinutes: 20,
      orderIndex: 1,
      courseId: course.id,
    },
  });
  await call(`/courses/${course.id}`, {
    token: staffToken,
    method: "PUT",
    body: {
      title: `RBAC QA course ${suffix}`,
      description: "Updated by Staff",
      price: 0,
      categoryId: category.id,
    },
  });
  await call(`/courses/${course.id}/staff`, {
    token: adminToken,
    method: "PUT",
    body: { staffId: staff.id },
  });
  const detail = await call(`/courses/${course.id}`);
  assert.equal(detail.staffId, staff.id);
  await call(`/lessons/${lesson.id}`, { token: staffToken });
  const invalidFile = new FormData();
  invalidFile.set("file", new Blob(["invalid data"]), "invalid.pdf");
  await call(`/files/lessons/${lesson.id}/document`, {
    token: staffToken,
    method: "POST",
    body: invalidFile,
    status: 400,
  });
  const pdf = new FormData();
  pdf.set(
    "file",
    new Blob(["%PDF-1.4\n1 0 obj<</Type /Catalog>>endobj\n%%EOF"]),
    "rbac-qa.pdf",
  );
  const file = await call(`/files/lessons/${lesson.id}/document`, {
    token: staffToken,
    method: "POST",
    body: pdf,
    status: 201,
  });
  pass(
    "Staff operates courses, lessons and files; Admin assigns Staff; invalid file signatures are rejected",
  );

  for (const route of ["/users", "/enrollments"])
    await call(route, { token: userToken, status: 403 });
  await call("/courses", {
    token: userToken,
    method: "POST",
    body: { title: "Rejected", price: 0, categoryId: category.id },
    status: 403,
  });
  await call(`/lessons/${lesson.id}`, { token: userToken, status: 403 });
  await call(`/files/${file.id}/download`, { token: userToken, status: 403 });
  await call("/enrollments", {
    token: userToken,
    method: "POST",
    body: { courseId: course.id },
    status: 201,
  });
  enrolled = true;
  await call(`/lessons/${lesson.id}`, { token: userToken });
  const download = await call(`/files/${file.id}/download`, {
    token: userToken,
    binary: true,
  });
  assert.ok(download.byteLength > 0);
  await call(`/progress/lessons/${lesson.id}/complete`, {
    token: userToken,
    method: "POST",
  });
  assert.equal(
    (await call(`/progress/courses/${course.id}`, { token: userToken }))
      .percentage,
    100,
  );
  await call(`/progress/courses/${course.id}`, {
    token: otherToken,
    status: 403,
  });
  await call(`/lessons/${lesson.id}`, { token: otherToken, status: 403 });
  pass(
    "User reads/downloads only enrolled content, owns progress, and cannot access management",
  );

  const teacher = await account("teacher", "Instructor");
  const secondTeacher = await account("teacher-other", "Instructor");
  const teacherToken = (await login(teacher.email)).token;
  const secondTeacherToken = (await login(secondTeacher.email)).token;
  const courseBody = {
    title: `RBAC QA teaching ${suffix}`, description: "Instructor ownership",
    price: 0, categoryId: category.id,
  };
  const teachingCourse = await call("/courses", {
    token: teacherToken, method: "POST", status: 201,
    body: { ...courseBody, instructorId: secondTeacher.id, staffId: staff.id },
  });
  assert.equal(teachingCourse.instructorId, teacher.id);
  assert.equal(teachingCourse.staffId, null);
  const ownLessonBody = {
    title: "RBAC QA teaching lesson", content: "Private teaching content",
    durationMinutes: 15, orderIndex: 1, courseId: teachingCourse.id,
  };
  const teachingLesson = await call("/lessons", {
    token: teacherToken, method: "POST", status: 201, body: ownLessonBody,
  });
  await call(`/courses/${teachingCourse.id}`, { token: teacherToken, method: "PUT", body: courseBody });
  await call(`/lessons/${teachingLesson.id}`, { token: teacherToken });
  await call(`/lessons/${teachingLesson.id}`, { token: teacherToken, method: "PUT", body: ownLessonBody });
  assert.ok((await call("/courses/my", { token: teacherToken })).every(c => c.instructorId === teacher.id));
  assert.ok((await call("/courses/my", { token: staffToken })).every(c => c.staffId === staff.id));
  for (const route of ["/users", "/enrollments", "/users?Role=Instructor"])
    await call(route, { token: teacherToken, status: 403 });
  await call("/categories", { token: teacherToken, method: "POST", body: { name: "Forbidden" }, status: 403 });
  await call(`/users/${other.id}/role`, { token: teacherToken, method: "PUT", body: { role: "Instructor" }, status: 403 });
  await call(`/users/${teacher.id}/reset-password`, { token: staffToken, method: "PUT", body: { newPassword: password }, status: 403 });
  await call("/users?Role=Instructor", { token: staffToken, status: 403 });
  for (const token of [staffToken, userToken, teacherToken]) {
    await call(`/courses/${course.id}/instructor`, { token, method: "PUT", body: { instructorId: teacher.id }, status: 403 });
  }
  await call(`/courses/${course.id}/instructor`, { token: adminToken, method: "PUT", body: { instructorId: staff.id }, status: 400 });
  await call(`/courses/${course.id}/staff`, { token: adminToken, method: "PUT", body: { staffId: teacher.id }, status: 400 });
  pass("Instructor creates own courses; account administration and global reports remain restricted");

  for (const method of ["PUT", "DELETE"])
    await call(`/courses/${teachingCourse.id}`, { token: secondTeacherToken, method, body: method === "PUT" ? courseBody : undefined, status: 403 });
  await call(`/lessons/${teachingLesson.id}`, { token: secondTeacherToken, status: 403 });
  await call(`/lessons/${teachingLesson.id}`, { token: secondTeacherToken, method: "DELETE", status: 403 });
  await call("/lessons", { token: secondTeacherToken, method: "POST", body: { ...ownLessonBody, orderIndex: 2 }, status: 403 });
  await call(`/lessons/${teachingLesson.id}`, { token: teacherToken, method: "PUT", body: { ...ownLessonBody, courseId: course.id }, status: 403 });
  await call(`/lessons/${lesson.id}`, { token: teacherToken, method: "PUT", body: { ...ownLessonBody, orderIndex: 2 }, status: 403 });
  await call(`/progress/courses/${teachingCourse.id}/students`, { token: secondTeacherToken, status: 403 });
  await call(`/enrollments/course/${teachingCourse.id}`, { token: secondTeacherToken, status: 403 });
  const document = () => {
    const data = new FormData();
    data.set("file", new Blob(["%PDF-1.4\n%%EOF"]), "teaching.pdf");
    return data;
  };
  const teachingFile = await call(`/files/lessons/${teachingLesson.id}/document`, { token: teacherToken, method: "POST", body: document(), status: 201 });
  await call(`/files/${teachingFile.id}/download`, { token: teacherToken, binary: true });
  await call(`/files/lessons/${teachingLesson.id}/document`, { token: secondTeacherToken, method: "POST", body: document(), status: 403 });
  await call(`/files/${teachingFile.id}/download`, { token: secondTeacherToken, binary: true, status: 403 });
  await call(`/files/${teachingFile.id}`, { token: secondTeacherToken, method: "DELETE", status: 403 });
  await call(`/files/${teachingFile.id}`, { token: teacherToken, method: "DELETE" });
  created.files.delete(teachingFile.id);
  pass("Instructor ownership enforced for course/lesson edits, lesson moves, reports and file operations");

  await call(`/courses/${course.id}/instructor`, { token: adminToken, method: "PUT", body: { instructorId: teacher.id } });
  const assigned = await call(`/courses/${course.id}`);
  assert.equal(assigned.instructorId, teacher.id);
  assert.equal(assigned.staffId, staff.id);
  const teachingStudents = await call(`/progress/courses/${course.id}/students`, { token: teacherToken });
  assert.ok(teachingStudents.students.some(s => s.studentId === userAccount.id && s.percentage === 100));
  await call(`/enrollments/course/${course.id}`, { token: teacherToken });
  await call(`/users/${teacher.id}/role`, { token: adminToken, method: "PUT", body: { role: "User" }, status: 409 });
  await call(`/courses/${course.id}/instructor`, { token: adminToken, method: "PUT", body: { instructorId: secondTeacher.id } });
  await call(`/lessons/${lesson.id}`, { token: teacherToken, status: 403 });
  await call(`/progress/courses/${course.id}/students`, { token: teacherToken, status: 403 });
  await call(`/lessons/${lesson.id}`, { token: secondTeacherToken });
  await call(`/courses/${course.id}/instructor`, { token: adminToken, method: "PUT", body: { instructorId: teacher.id } });
  await call(`/users/${secondTeacher.id}/role`, { token: adminToken, method: "PUT", body: { role: "User" } });
  await call("/auth/me", { token: secondTeacherToken, status: 401 });
  pass("Admin assigns independent Staff/Instructor; reassignment revokes ownership and role changes revoke sessions");
  await call(`/lessons/${teachingLesson.id}`, { token: teacherToken, method: "DELETE" });
  created.lessons.delete(teachingLesson.id);
  await call(`/courses/${teachingCourse.id}`, { token: teacherToken, method: "DELETE" });
  created.courses.delete(teachingCourse.id);

  const directory = await call("/users?PageSize=100&AllowedRoles=Admin", {
    token: staffToken,
  });
  assert.ok(directory.items.every((user) => user.role === "User"));
  await call("/users?Role=Admin", { token: staffToken, status: 403 });
  await call("/users?Role=Staff", { token: staffToken, status: 403 });
  await call(`/users/${qaAdmin.id}`, { token: staffToken, status: 403 });
  await call(`/users/${staff.id}`, { token: staffToken, status: 403 });
  await call("/users", {
    token: staffToken,
    method: "POST",
    body: {
      fullName: "Rejected",
      email: "rejected@example.test",
      password,
      role: "Admin",
    },
    status: 403,
  });
  await call(`/users/${other.id}/role`, {
    token: staffToken,
    method: "PUT",
    body: { role: "Admin" },
    status: 403,
  });
  await call(`/users/${other.id}`, {
    token: staffToken,
    method: "DELETE",
    status: 403,
  });
  await call(`/courses/${course.id}/staff`, {
    token: staffToken,
    method: "PUT",
    body: { staffId: staff.id },
    status: 403,
  });
  for (const id of [qaAdmin.id, staff.id])
    await call(`/users/${id}/reset-password`, {
      token: staffToken,
      method: "PUT",
      body: { newPassword: password + "2" },
      status: 403,
    });
  pass(
    "Staff directory scope and all account/role escalation routes are enforced server-side",
  );

  await call(`/users/${qaAdmin.id}/role`, {
    token: qaAdminToken,
    method: "PUT",
    body: { role: "User" },
    status: 400,
  });
  await call(`/users/${qaAdmin.id}`, {
    token: qaAdminToken,
    method: "DELETE",
    status: 400,
  });
  await call(`/users/${other.id}/role`, {
    token: adminToken,
    method: "PUT",
    body: { role: "Student" },
    status: 400,
  });
  await call(`/users/${staff.id}/role`, {
    token: adminToken,
    method: "PUT",
    body: { role: "User" },
    status: 409,
  });
  pass(
    "self-demotion/deletion, retired roles and demoting assigned Staff are blocked",
  );

  await call(`/users/${other.id}/role`, {
    token: adminToken,
    method: "PUT",
    body: { role: "Staff" },
  });
  await call("/auth/me", { token: otherToken, status: 401 });
  const promoted = await login(other.email);
  assert.equal(promoted.user.role, "Staff");
  await call(`/users/${other.id}/role`, {
    token: adminToken,
    method: "PUT",
    body: { role: "User" },
  });
  await call("/auth/me", { token: promoted.token, status: 401 });
  await call("/auth/me", { token: otherToken, status: 401 });
  otherToken = (await login(other.email)).token;
  pass(
    "role changes revoke old sessions immediately, including after a role is restored",
  );

  userPassword = password + "new";
  await call(`/users/${userAccount.id}/reset-password`, {
    token: staffToken,
    method: "PUT",
    body: { newPassword: userPassword },
  });
  await call("/auth/me", { token: userToken, status: 401 });
  await call("/auth/login", {
    method: "POST",
    body: { email: userAccount.email, password },
    status: 401,
  });
  userToken = (await login(userAccount.email, userPassword)).token;
  await call(`/users/${staff.id}/reset-password`, {
    token: adminToken,
    method: "PUT",
    body: { newPassword: password + "staff" },
  });
  await call("/auth/me", { token: staffToken, status: 401 });
  const profile = await call("/auth/me", { token: userToken });
  assert.equal(profile.passwordHash, undefined);
  assert.equal(profile.securityStamp, undefined);
  pass(
    "password reset scope, immediate session revocation and private credential fields",
  );

  await call(`/users/${other.id}`, { token: adminToken, method: "DELETE" });
  created.users.delete(other.id);
  await call("/auth/me", { token: otherToken, status: 401 });
  pass("deleted accounts cannot reuse issued tokens");
} finally {
  if (adminToken) {
    const cleanup = async (route, status = 200) => {
      try {
        await call(route, { token: adminToken, method: "DELETE", status });
      } catch (error) {
        console.error(`Cleanup failed: ${error.message}`);
        process.exitCode = 1;
      }
    };
    if (enrolled && userAccount && course) {
      try {
        userToken = (await login(userAccount.email, userPassword)).token;
        await call(`/enrollments/${course.id}`, {
          token: userToken,
          method: "DELETE",
        });
      } catch (error) {
        console.error(`Enrollment cleanup failed: ${error.message}`);
        process.exitCode = 1;
      }
    }
    for (const id of created.files) await cleanup(`/files/${id}`);
    for (const id of created.lessons) await cleanup(`/lessons/${id}`);
    for (const id of created.courses) await cleanup(`/courses/${id}`);
    for (const id of created.categories)
      await cleanup(`/categories/${id}`, 204);
    for (const id of created.users) await cleanup(`/users/${id}`);
    console.log("Temporary authorization QA records cleaned up.");
  }
}
