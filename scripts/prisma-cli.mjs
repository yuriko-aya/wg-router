import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const toolsRoot = process.env.PRISMA_TOOLS_ROOT?.trim();
const moduleRoot = toolsRoot || root;
const cli = path.join(moduleRoot, "node_modules", "prisma", "build", "index.js");

const result = spawnSync(process.execPath, [cli, ...process.argv.slice(2)], {
  stdio: "inherit",
  cwd: root,
  env: process.env,
});

process.exit(result.status ?? 1);
