import { test } from "node:test";
import assert from "node:assert/strict";
import { createApiConfig, apiUrl } from "../src/config.js";

test("local development uses the frontend proxy", () => {
  assert.deepEqual(createApiConfig(), {
    apiBaseUrl: "/api",
    docsUrl: "/swagger",
  });
  assert.equal(apiUrl("/courses"), "/api/courses");
  assert.equal(apiUrl("courses"), "/api/courses");
});

test("a separate production API also provides its own Swagger URL", () => {
  assert.deepEqual(createApiConfig("https://api.example.com/api"), {
    apiBaseUrl: "https://api.example.com/api",
    docsUrl: "https://api.example.com/swagger",
  });
});

test("a trailing slash in deployment configuration is normalized", () => {
  assert.deepEqual(createApiConfig("https://api.example.com/api/"), {
    apiBaseUrl: "https://api.example.com/api",
    docsUrl: "https://api.example.com/swagger",
  });
});
