import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import {
  ensureDatabaseUrlEnv,
  isPostgresDatabaseUrl,
  isSqliteDatabaseUrl,
  resolveSqliteFilePath,
} from "./db-url.mjs";

const databaseUrl = ensureDatabaseUrlEnv();

if (isSqliteDatabaseUrl(databaseUrl)) {
  const absolute = resolveSqliteFilePath(databaseUrl);
  mkdirSync(path.dirname(absolute), { recursive: true });
  console.log(`Applying SQLite schema with prisma db push (${databaseUrl})`);
  execSync("node scripts/prisma-cli.mjs db push --skip-generate", {
    stdio: "inherit",
  });
} else if (isPostgresDatabaseUrl(databaseUrl)) {
  console.log(`Applying PostgreSQL migrations (${databaseUrl})`);
  execSync("node scripts/prisma-cli.mjs migrate deploy", { stdio: "inherit" });
} else {
  throw new Error(
    `Unsupported DATABASE_URL scheme: ${databaseUrl}. Use file:... or postgresql://...`,
  );
}
