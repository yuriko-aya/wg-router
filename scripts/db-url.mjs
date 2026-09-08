import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

// Relative SQLite paths are resolved from prisma/schema.prisma (see resolveSqliteFilePath).
export const DEFAULT_SQLITE_DATABASE_URL = "file:../data/wg-router.db";

function loadEnvFile() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export function resolveDatabaseUrl() {
  loadEnvFile();
  return process.env.DATABASE_URL?.trim() || DEFAULT_SQLITE_DATABASE_URL;
}

export function isPostgresDatabaseUrl(databaseUrl = resolveDatabaseUrl()) {
  return (
    databaseUrl.startsWith("postgresql://") ||
    databaseUrl.startsWith("postgres://")
  );
}

export function isSqliteDatabaseUrl(databaseUrl = resolveDatabaseUrl()) {
  return databaseUrl.startsWith("file:");
}

export function ensureDatabaseUrlEnv() {
  const databaseUrl = resolveDatabaseUrl();
  process.env.DATABASE_URL = databaseUrl;
  return databaseUrl;
}

export function resolveSqliteFilePath(databaseUrl = resolveDatabaseUrl()) {
  const raw = databaseUrl.replace(/^file:/, "");
  if (path.isAbsolute(raw)) {
    return raw;
  }

  // Prisma resolves relative SQLite paths from the schema directory.
  return path.resolve(process.cwd(), "prisma", raw);
}
