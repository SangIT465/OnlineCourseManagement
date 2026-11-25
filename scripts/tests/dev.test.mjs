import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { inspectBackend } from "../dev-backend.mjs";

async function withServer(handler, run) {
  const server = createServer(handler);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  try { await run(port); }
  finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}

test("dev starts a backend when its port is free", async () => {
  let freePort;
  await withServer((_req, res) => res.end(), async port => { freePort = port; });
  assert.equal(await inspectBackend(freePort), "start");
});

test("dev reuses a healthy CourseFlow API already listening on the port", async () => {
  await withServer((req, res) => {
    if (req.url === "/health") res.end("Healthy");
    else {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ name: "CourseFlow API" }));
    }
  }, async port => {
    assert.equal(await inspectBackend(port), "reuse");
    assert.equal((await fetch(`http://127.0.0.1:${port}/health`)).status, 200);
  });
});

test("dev reports an unrelated occupied port instead of reusing its service", async () => {
  await withServer((_req, res) => res.end("Another application"), async port => {
    await assert.rejects(inspectBackend(port), /already in use.*could not be verified/);
  });
});

test("dev does not reuse an API whose health endpoint fails", async () => {
  await withServer((req, res) => {
    if (req.url === "/health") { res.statusCode = 503; res.end("Unhealthy"); }
    else res.end(JSON.stringify({ name: "CourseFlow API" }));
  }, async port => {
    await assert.rejects(inspectBackend(port), /already in use.*could not be verified/);
  });
});
