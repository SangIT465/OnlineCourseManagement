import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const frontend = path.join(root, "frontend");
const requireFrontend = createRequire(path.join(frontend, "package.json"));
const vite = path.join(
  path.dirname(requireFrontend.resolve("vite/package.json")),
  "bin",
  "vite.js",
);

for (const [command, args, cwd] of [
  [
    "dotnet",
    ["build", "OnlineCourseManagement.sln", "--configuration", "Release"],
    root,
  ],
  [process.execPath, [vite, "build"], frontend],
]) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) console.error(result.error.message);
  if (result.error || result.status !== 0) process.exit(result.status || 1);
}
