import { spawnSync } from "node:child_process";
import { isPostgresDatabaseUrl } from "./db-url.mjs";

if (isPostgresDatabaseUrl()) {
  const result = spawnSync("node", ["scripts/prisma-cli.mjs", "generate"], {
    stdio: "inherit",
  });
  process.exit(result.status ?? 1);
}
