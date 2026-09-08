import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import {
  ensureDatabaseUrlEnv,
  isPostgresDatabaseUrl,
} from "./db-url.mjs";

const databaseUrl = ensureDatabaseUrlEnv();
const provider = isPostgresDatabaseUrl(databaseUrl) ? "postgresql" : "sqlite";
const source = path.join("prisma", `schema.${provider}.prisma`);
const target = path.join("prisma", "schema.prisma");

mkdirSync(path.dirname(target), { recursive: true });
copyFileSync(source, target);

console.log(`Prepared Prisma schema for ${provider} (${databaseUrl})`);
