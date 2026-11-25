import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { adminCredentials } from "./support/admin-credentials.mjs";

// Exercise every documented operation without creating application data.
// Successful business workflows are covered by the CRUD/auth/authorization suites.
const base = new URL(process.env.COURSEFLOW_API_URL || "http://localhost:5106/api").origin;
const methods = new Set(["get", "post", "put", "patch", "delete", "head", "options"]);
const checks = [];
async function request(route, { method = "GET", token, body, expected } = {}) {
  const multipart = body instanceof FormData;
  const response = await fetch(base + route, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined || multipart ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : multipart ? body : JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  assert.equal(response.status, expected, `${method} ${route}: expected ${expected}, received ${response.status}`);
  checks.push({ method, route, status: response.status });
  return data;
}

const document = await request("/swagger/v1/swagger.json", { expected: 200 });
await request("/swagger/index.html", { expected: 200 });
assert.equal(document.components.securitySchemes.Bearer.scheme, "bearer");
const operations = Object.entries(document.paths).flatMap(([route, path]) =>
  Object.entries(path).filter(([method]) => methods.has(method)).map(([method, operation]) => ({ route, method, operation })));
assert.ok(operations.length > 0, "Swagger must expose API operations");
const invalidPublicWrites = new Set(["/api/auth/login", "/api/auth/register", "/api/purchases/payos/webhook"]);

for (const { route, method, operation } of operations) {
  const resolved = route.replace(/\{[^}]+\}/g, "2147483647");
  const secured = (operation.security ?? document.security ?? []).some(item => Object.keys(item).length > 0);
  let expected;
  if (secured) expected = 401;
  else if (method === "get") expected = route.includes("{") ? 404 : 200;
  else {
    assert.ok(invalidPublicWrites.has(route), `Review this new anonymous write before testing it: ${method} ${route}`);
    expected = 400;
  }
  const body = operation.requestBody?.content?.["multipart/form-data"] ? new FormData() :
    ["post", "put", "patch"].includes(method) ? {} : undefined;
  await request(resolved, { method: method.toUpperCase(), body, expected });
  console.log(`PASS ${method.toUpperCase()} ${route} -> ${expected}`);
}

const admin = await request("/api/auth/login", { method: "POST", body: await adminCredentials(), expected: 200 });
for (const { route } of operations.filter(item => item.method === "get")) {
  const expected = ["/api/auth/student-only", "/api/auth/user-only", "/api/courses/my", "/api/Enrollments/my", "/api/progress/my", "/api/progress/courses/{courseId}", "/api/purchases/my"].includes(route) ? 403 :
    route.includes("{") ? 404 : 200;
  await request(route.replace(/\{[^}]+\}/g, "2147483647"), { token: admin.token, expected });
}
await request("/api/auth/me", { token: "invalid.jwt.signature", expected: 401 });
for (const route of ["/health", "/health/ready"]) await request(route, { expected: 200 });

const result = { checkedAt: new Date().toISOString(), openapi: document.openapi, operations: operations.length, checks };
await mkdir("artifacts/api-audit", { recursive: true });
await writeFile("artifacts/api-audit/swagger-results.json", JSON.stringify(result, null, 2) + "\n");
console.log(`PASS all ${operations.length} Swagger operations; ${checks.length} total HTTP checks. No test records created.`);
