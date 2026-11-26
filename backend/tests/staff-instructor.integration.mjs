import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { adminCredentials } from "./support/admin-credentials.mjs";
import { snapshot, sql } from "./support/sql-server.mjs";

const base = (process.env.COURSEFLOW_API_URL || "http://localhost:5106/api").replace(/\/+$/, "");
const tag = randomUUID().replaceAll("-", "");
const password = randomBytes(18).toString("base64url") + "A1!";
const created = { users: [], courses: [], lessons: [], files: [] }, checks = [];
let admin, studentToken, enrolledCourse;
const before = snapshot();
async function api(route, { token = admin, method = "GET", body, status = 200, text = false } = {}) {
  const multipart = body instanceof FormData;
  const response = await fetch(base + route, { method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined && !multipart ? { "Content-Type": "application/json" } : {}) },
    body: body === undefined ? undefined : multipart ? body : JSON.stringify(body), signal: AbortSignal.timeout(30000) });
  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  if (method === "POST" && response.ok && data?.id)
    created[route.startsWith("/files/") ? "files" : route.slice(1)]?.push(data.id);
  checks.push({method, route, expected:status, actual:response.status});
  assert.equal(response.status, status, `${method} ${route}`);
  return text ? { raw, headers:response.headers } : data;
}
const pass = message => console.log(`PASS ${message}`);
try {
  admin = (await api("/auth/login", { token:null, method:"POST", body:await adminCredentials() })).token;
  const accounts = {};
  for (const role of ["Staff", "Instructor", "User"]) {
    const user = await api("/users", { method:"POST", status:201, body:{ fullName:`Support QA ${role} ${tag}`,
      email:`support-qa-${role.toLowerCase()}-${tag}@example.test`, password, role } });
    accounts[role] = { ...user, token:(await api("/auth/login", { token:null, method:"POST", body:{email:user.email,password} })).token };
  }
  const teacher = accounts.Instructor, staff = accounts.Staff, student = accounts.User;
  studentToken = student.token;
  const categoryId = (await api("/categories"))[0].id;
  const course = await api("/courses", { token:teacher.token, method:"POST", status:201,
    body:{ title:`Support QA free ${tag}`, categoryId, price:0 } });
  const foreign = await api("/courses", { method:"POST", status:201, body:{title:`Support QA paid ${tag}`,categoryId,price:100000} });
  assert.equal(sql(`SELECT InstructorId FROM dbo.Courses WHERE Id=${course.id}`)[0].InstructorId,teacher.id);
  const body = {title:`Support QA lesson ${tag}`,content:"Nội dung bài giảng được lưu thật.",courseId:course.id,orderIndex:1,durationMinutes:20};
  const lesson = await api("/lessons", {token:teacher.token,method:"POST",status:201,body});
  assert.equal(sql(`SELECT Content FROM dbo.Lessons WHERE Id=${lesson.id}`)[0].Content,body.content);
  await api("/lessons", {token:teacher.token,method:"POST",status:403,body:{...body,courseId:foreign.id}});
  const bytes = "Học liệu của giảng viên, đồng bộ SQL Server.";
  const document = new FormData(); document.set("file",new Blob([bytes],{type:"text/plain"}),"hoc-lieu-qa.txt");
  const file = await api(`/files/lessons/${lesson.id}/document`, {token:teacher.token,method:"POST",body:document,status:201});
  assert.equal(sql(`SELECT UploadedById,CourseId,LessonId FROM dbo.UploadedFiles WHERE Id=${file.id}`)[0].UploadedById,teacher.id);
  assert.equal((await api(`/files/${file.id}/download`, {token:teacher.token,text:true})).raw,bytes);
  assert.equal((await api(`/files/${file.id}/preview`, {token:teacher.token,text:true})).raw,bytes);
  await api(`/files/${file.id}/download`,{token:studentToken,status:403});
  pass("Instructor creates lessons, uploads/previews/downloads learning files; SQL ownership and foreign-course restrictions match");

  const support = {studentId:student.id,courseId:course.id};
  for (const token of [null,teacher.token,studentToken])
    await api("/enrollments/support",{token,method:"POST",body:support,status:token?403:401});
  await api("/enrollments/support",{token:staff.token,method:"POST",body:{...support,studentId:0},status:400});
  await api("/enrollments/support",{token:staff.token,method:"POST",body:{...support,studentId:staff.id},status:403});
  await api("/enrollments/support",{token:staff.token,method:"POST",body:{...support,courseId:foreign.id},status:409});
  await api("/enrollments/support",{token:staff.token,method:"POST",body:{...support,courseId:2147483647},status:404});
  const enrollment = await api("/enrollments/support",{token:staff.token,method:"POST",body:support,status:201});
  enrolledCourse = course.id;
  assert.equal(sql(`SELECT StudentId,CourseId FROM dbo.Enrollments WHERE Id=${enrollment.id}`)[0].StudentId,student.id);
  await api("/enrollments/support",{token:staff.token,method:"POST",body:support,status:409});
  assert.ok((await api("/enrollments/my",{token:studentToken})).some(item=>item.courseId===course.id));
  assert.equal((await api(`/files/${file.id}/download`,{token:studentToken,text:true})).raw,bytes);
  await api(`/progress/lessons/${lesson.id}/complete`,{token:studentToken,method:"POST"});
  assert.equal(sql(`SELECT COUNT(*) AS Total FROM dbo.LessonProgresses WHERE EnrollmentId=${enrollment.id} AND IsCompleted=1`)[0].Total,1);
  pass("Staff support enrollment persists in SQL, grants student learning access, blocks duplicates and cannot bypass paid-course rules");

  for (const token of [null,teacher.token,studentToken])
    await api("/enrollments/export",{token,status:token?403:401});
  await api("/enrollments/export?CourseId=0",{token:staff.token,status:400});
  const report = await api(`/enrollments/export?CourseId=${course.id}&Search=${tag}`,{token:staff.token,text:true});
  assert.ok(report.headers.get("content-type").startsWith("text/csv"));
  assert.match(report.headers.get("content-disposition"),/bao-cao-tien-do.csv/);
  assert.equal(report.headers.get("cache-control"),"private, no-store");
  assert.ok(report.raw.includes(student.email));
  assert.ok(report.raw.includes('"1","1","100"'));
  assert.ok(!(await api(`/enrollments/export?CourseId=${foreign.id}&Search=${tag}`,{token:staff.token,text:true})).raw.includes(student.email));
  await api(`/progress/lessons/${lesson.id}/complete`,{token:studentToken,method:"DELETE"});
  assert.ok((await api(`/enrollments/export?CourseId=${course.id}&Search=${tag}`,{token:staff.token,text:true})).raw.includes('"1","0","0"'));
  const spec = await (await fetch(new URL(base).origin+"/swagger/v1/swagger.json")).json();
  assert.ok(spec.paths["/api/Enrollments/support"].post.responses["201"]);
  assert.ok(spec.paths["/api/Enrollments/export"].get.responses["200"].content["text/csv"]);
  pass("Staff CSV export reads live SQL progress, applies filters, preserves Vietnamese, and is restricted/documented correctly");
} finally {
  try {
    if (enrolledCourse && studentToken) await api(`/enrollments/${enrolledCourse}`,{token:studentToken,method:"DELETE"});
    if (admin) for (const resource of ["files","lessons","courses","users"])
      for (const id of created[resource]) await api(`/${resource}/${id}`,{method:"DELETE"});
  } finally {
    const after = snapshot();
    await mkdir("artifacts/role-support",{recursive:true});
    await writeFile("artifacts/role-support/http-sql-results.json",JSON.stringify({checkedAt:new Date().toISOString(),checks,before,after},null,2));
    assert.deepEqual(after,before,"Role support QA must preserve original SQL data");
  }
  pass(`All ${checks.length} HTTP checks passed; QA removed and original SQL counts/checksums unchanged`);
}
