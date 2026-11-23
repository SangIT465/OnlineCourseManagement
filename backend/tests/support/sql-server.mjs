import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";

// sqlcmd's console encoding can corrupt Vietnamese. Its Unicode file preserves it.
export function sql(query) {
  const output = path.join(os.tmpdir(), `courseflow-sql-${randomUUID()}.txt`);
  try {
    const result = spawnSync("sqlcmd", [
      "-S", process.env.COURSEFLOW_TEST_SQL_SERVER || ".\\SQLEXPRESS",
      "-d", process.env.COURSEFLOW_TEST_SQL_DATABASE || "OnlineCourseDB",
      "-E", "-C", "-b", "-r", "1", "-y", "0", "-w", "65535", "-u", "-o", output,
      "-Q", `SET NOCOUNT ON; ${query} FOR JSON PATH;`,
    ], { encoding: "utf8", windowsHide: true, timeout: 30000, maxBuffer: 2 * 1024 * 1024 });
    if (result.error) throw result.error;
    assert.equal(result.status, 0, "SQL verification failed; check the configured test database.");
    // FOR JSON may be split into multiple sqlcmd rows, including inside a JSON string.
    const json = readFileSync(output, "utf16le").replace(/^\uFEFF/, "").replace(/[\r\n]/g, "").trim();
    try { return JSON.parse(json); }
    catch { throw new Error("SQL verification returned unreadable JSON."); }
  } finally {
    if (existsSync(output)) unlinkSync(output);
  }
}

export function snapshot() {
  const tables = ["Users", "Categories", "Courses", "Lessons", "Enrollments", "LessonProgresses", "UploadedFiles"];
  return sql(`SELECT * FROM (${tables.map(table =>
    `SELECT N'${table}' AS TableName, COUNT_BIG(*) AS Total, CHECKSUM_AGG(BINARY_CHECKSUM(*)) AS Fingerprint FROM dbo.[${table}]`
  ).join(" UNION ALL ")}) AS Counts ORDER BY TableName`);
}
