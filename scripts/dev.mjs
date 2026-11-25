import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inspectBackend } from "./dev-backend.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const frontend = path.join(root, "frontend");
const backend = path.join(root, "backend", "OnlineCourseManagement.Api");
const requireFrontend = createRequire(path.join(frontend, "package.json"));
let vite;
try {
  vite = path.join(
    path.dirname(requireFrontend.resolve("vite/package.json")),
    "bin",
    "vite.js",
  );
} catch {
  console.error(
    "Dependencies are missing. Run npm install from the repository root first.",
  );
  process.exit(1);
}

const children = [];
let stopping = false;

function stopChild(child) {
  if (child.exitCode !== null || !child.pid) return Promise.resolve();
  return new Promise((resolve) => {
    child.once("exit", resolve);
    if (process.platform === "win32") {
      const killer = spawn(
        "taskkill",
        ["/pid", String(child.pid), "/T", "/F"],
        {
          stdio: "ignore",
          windowsHide: true,
        },
      );
      killer.once("error", () => child.kill());
      killer.once("exit", resolve);
    } else {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        child.kill("SIGTERM");
      }
    }
    setTimeout(resolve, 4000).unref();
  });
}

async function stop(code) {
  if (stopping) return;
  stopping = true;
  await Promise.all(children.map(stopChild));
  process.exit(code);
}

function start(command, args, cwd, name) {
  const child = spawn(command, args, {
    cwd,
    stdio: "inherit",
    windowsHide: true,
    detached: process.platform !== "win32",
  });
  children.push(child);
  child.once("error", (error) => {
    console.error(`${name} could not start: ${error.message}`);
    void stop(1);
  });
  child.once("exit", (code, signal) => {
    if (!stopping) {
      console.log(
        `${name} stopped (${signal || code}). Shutting down applications started by this command.`,
      );
      void stop(code ?? 1);
    }
  });
}

process.on("SIGINT", () => {
  void stop(0);
});
process.on("SIGTERM", () => {
  void stop(0);
});
console.log("CourseFlow frontend: http://localhost:5173");
console.log("CourseFlow backend:  http://localhost:5106/swagger");
let backendMode;
try {
  backendMode = await inspectBackend();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
if (backendMode === "reuse") {
  console.log("CourseFlow API is already running. Reusing it; starting only the frontend.");
  console.log("Press Ctrl+C to stop the frontend. The existing API will keep running.\n");
} else {
  console.log("Press Ctrl+C to stop both applications.\n");
  start(
    "dotnet",
    ["run", "--project", backend, "--launch-profile", "http"],
    backend,
    "Backend",
  );
}
start(process.execPath, [vite], frontend, "Frontend");
