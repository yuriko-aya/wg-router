import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import {
  ensureDatabaseUrlEnv,
  isPostgresDatabaseUrl,
  isSqliteDatabaseUrl,
} from "./db-url.mjs";

const databaseUrl = ensureDatabaseUrlEnv();

if (isSqliteDatabaseUrl(databaseUrl)) {
  const filePath = databaseUrl.replace(/^file:/, "");
  const absolute = path.resolve(process.cwd(), filePath);
  mkdirSync(path.dirname(absolute), { recursive: true });
  console.log(`Applying SQLite schema with prisma db push (${databaseUrl})`);
  execSync("npx prisma db push --skip-generate", { stdio: "inherit" });
} else if (isPostgresDatabaseUrl(databaseUrl)) {
  console.log(`Applying PostgreSQL migrations (${databaseUrl})`);
  execSync("npx prisma migrate deploy", { stdio: "inherit" });
} else {
  throw new Error(
    `Unsupported DATABASE_URL scheme: ${databaseUrl}. Use file:... or postgresql://...`,
  );
}
