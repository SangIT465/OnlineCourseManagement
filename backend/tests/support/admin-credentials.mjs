import { readFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

export async function adminCredentials() {
  if (process.env.COURSEFLOW_TEST_ADMIN_EMAIL && process.env.COURSEFLOW_TEST_ADMIN_PASSWORD)
    return { email: process.env.COURSEFLOW_TEST_ADMIN_EMAIL, password: process.env.COURSEFLOW_TEST_ADMIN_PASSWORD };
  const root = process.env.APPDATA
    ? path.join(process.env.APPDATA, "Microsoft", "UserSecrets")
    : path.join(os.homedir(), ".microsoft", "usersecrets");
  const secrets = JSON.parse((await readFile(path.join(root, "57665c0f-8f02-41c2-8d81-b48d6e592b4e", "secrets.json"), "utf8")).replace(/^\uFEFF/, ""));
  const email = secrets["AdminSeed:Email"], password = secrets["AdminSeed:Password"];
  if (!email || !password) throw new Error("Configure the test Admin through environment variables or User Secrets.");
  return { email, password };
}
