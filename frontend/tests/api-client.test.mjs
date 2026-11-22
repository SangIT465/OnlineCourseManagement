import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  request,
  setToken,
  getToken,
  escapeHtml,
  safeUrl,
  query,
} from "../src/api/client.js";

const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
const originalStorage = globalThis.sessionStorage;
let values;
let expired;

beforeEach(() => {
  values = new Map();
  expired = 0;
  globalThis.sessionStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  globalThis.window = {
    dispatchEvent: (event) => {
      if (event.type === "session-expired") expired++;
    },
  };
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.window = originalWindow;
  globalThis.sessionStorage = originalStorage;
});

test("untrusted content stays text and video URLs cannot execute scripts", () => {
  assert.equal(
    escapeHtml('<img src=x onerror="alert(1)">'),
    "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
  );
  assert.equal(safeUrl("javascript:alert(1)"), null);
  assert.equal(safeUrl("data:text/html,<script>alert(1)</script>"), null);
  assert.equal(safeUrl("//example.com/video"), null);
  assert.equal(
    safeUrl("https://example.com/video"),
    "https://example.com/video",
  );
});

test("session is sent only in the Authorization header of same-origin API requests", async () => {
  setToken("test-session");
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "/api/courses");
    assert.equal(options.headers.Authorization, "Bearer test-session");
    assert.equal(options.credentials, "same-origin");
    return new Response("[]", { status: 200 });
  };
  assert.deepEqual(await request("/courses"), []);
});

test("validation failures retain useful field errors", async () => {
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        errors: {
          Email: ["Email không hợp lệ"],
          Password: ["Mật khẩu quá ngắn"],
        },
      }),
      { status: 400 },
    );
  await assert.rejects(
    request("/auth/register", { method: "POST", body: {} }),
    (error) =>
      error.status === 400 &&
      error.message.includes("Email không hợp lệ") &&
      error.message.includes("Mật khẩu quá ngắn"),
  );
});

test("server stack traces are not shown to users", async () => {
  globalThis.fetch = async () =>
    new Response(
      "System.InvalidOperationException:\nSensitive server diagnostics",
      { status: 500 },
    );
  await assert.rejects(
    request("/courses"),
    (error) =>
      error.status === 500 &&
      !error.message.includes("Sensitive") &&
      !error.message.includes("InvalidOperationException"),
  );
});

test("expired sessions are cleared and the interface is notified", async () => {
  setToken("expired-session");
  globalThis.fetch = async () => new Response(null, { status: 401 });
  await assert.rejects(request("/auth/me"), (error) => error.status === 401);
  assert.equal(getToken(), null);
  assert.equal(expired, 1);
});

test("a late unauthorized response cannot clear a newer login session", async () => {
  setToken("old-session");
  globalThis.fetch = async () => {
    setToken("new-session");
    return new Response(null, { status: 401 });
  };
  await assert.rejects(request("/auth/me"));
  assert.equal(getToken(), "new-session");
  assert.equal(expired, 0);
});

test("multipart uploads leave boundary generation to the browser", async () => {
  const file = new FormData();
  file.set("file", new Blob(["%PDF-1.4"]), "document.pdf");
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.headers["Content-Type"], undefined);
    assert.equal(options.body, file);
    return new Response(null, { status: 204 });
  };
  assert.equal(
    await request("/files/lessons/1/document", { method: "POST", body: file }),
    null,
  );
});

test("connection failure becomes a readable, recoverable error", async () => {
  globalThis.fetch = async () => {
    throw new TypeError("Failed to fetch");
  };
  await assert.rejects(
    request("/courses"),
    (error) =>
      error.status === 0 && error.message.includes("Không thể kết nối"),
  );
});

test("optional query parameters are omitted and search text is encoded", () => {
  const encoded = query({
    search: "C# & .NET",
    category: "",
    page: 2,
    role: null,
  });
  const parsed = new URLSearchParams(encoded);
  assert.equal(parsed.get("search"), "C# & .NET");
  assert.equal(parsed.get("page"), "2");
  assert.equal(parsed.has("category"), false);
  assert.equal(parsed.has("role"), false);
});
