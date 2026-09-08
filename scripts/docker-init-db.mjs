import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  ensureDatabaseUrlEnv,
  isPostgresDatabaseUrl,
  isSqliteDatabaseUrl,
  resolveSqliteFilePath,
} from "./db-url.mjs";

const root = process.cwd();
process.env.PRISMA_TOOLS_ROOT =
  process.env.PRISMA_TOOLS_ROOT?.trim() || "/app/prisma-tools";

function run(args) {
  const result = spawnSync("node", ["scripts/prisma-cli.mjs", ...args], {
    stdio: "inherit",
    cwd: root,
    env: process.env,
  });

  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}

const databaseUrl = ensureDatabaseUrlEnv();

if (isSqliteDatabaseUrl(databaseUrl)) {
  const dbPath = resolveSqliteFilePath(databaseUrl);
  mkdirSync(path.dirname(dbPath), { recursive: true });

  const template = path.join(root, "sqlite-template", "wg-router.db");
  if (!existsSync(dbPath)) {
    if (!existsSync(template)) {
      throw new Error(`SQLite template missing at ${template}`);
    }
    copyFileSync(template, dbPath);
    console.log(`Initialized SQLite database from template (${dbPath})`);
  }

  run(["db", "push", "--skip-generate"]);
  process.exit(0);
}

if (isPostgresDatabaseUrl(databaseUrl)) {
  run(["generate"]);
  run(["migrate", "deploy"]);
  process.exit(0);
}

throw new Error(
  `Unsupported DATABASE_URL scheme: ${databaseUrl}. Use file:... or postgresql://...`,
);
