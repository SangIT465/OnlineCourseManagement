import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { state } from "../src/state/store.js";
import { parseRoute, navigate, setupRouter } from "../src/router.js";

const originalLocation = globalThis.location;

beforeEach(() => {
  globalThis.location = { hash: "#/courses" };
});

afterEach(() => {
  globalThis.location = originalLocation;
});

test("hash routes retain course IDs, tabs and encoded Vietnamese searches", () => {
  const route = parseRoute("#/courses/12?tab=students&search=L%E1%BA%ADp+tr%C3%ACnh");
  assert.equal(route.page, "courses");
  assert.equal(route.id, 12);
  assert.equal(route.params.get("tab"), "students");
  assert.equal(route.params.get("search"), "Lập trình");
  assert.equal(parseRoute("").page, "dashboard");
  assert.equal(parseRoute("#/lesson/3").page, "lesson");
});

test("navigating to the current route reloads data and renders the page", () => {
  let renders = 0;
  setupRouter(() => { renders++; });
  state.ready = true;
  navigate("courses");
  assert.equal(state.ready, false);
  assert.equal(renders, 1);
});

test("navigating to a different route updates the hash for the browser", () => {
  setupRouter(() => assert.fail("hashchange handles rendering for a new route"));
  navigate("courses/12?tab=resources");
  assert.equal(location.hash, "/courses/12?tab=resources");
});
