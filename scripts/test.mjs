import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const folders = ["frontend/tests", "database/tests", "scripts/tests"];
const files = folders.flatMap((folder) =>
  readdirSync(new URL(`../${folder}/`, import.meta.url))
    .filter((file) => file.endsWith(".test.mjs"))
    .map((file) => `${folder}/${file}`),
);
const result = spawnSync(process.execPath, ["--test", ...files], {
  cwd: root,
  stdio: "inherit",
  windowsHide: true,
});
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
