import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const outDir = process.argv[2] || path.join(root, "prisma-runtime");

function topLevelDir(relativePath) {
  const parts = relativePath.split(path.sep);
  const nodeModulesIndex = parts.lastIndexOf("node_modules");
  if (nodeModulesIndex === -1) {
    return null;
  }

  const rest = parts.slice(nodeModulesIndex + 1);
  if (rest[0]?.startsWith("@")) {
    return rest.length >= 2 ? path.join(rest[0], rest[1]) : null;
  }

  return rest[0] ?? null;
}

function collectPackages() {
  const packages = new Set([
    ".prisma",
    "prisma",
    "@prisma/client",
    "@prisma/config",
    "@prisma/debug",
    "@prisma/engines",
    "@prisma/engines-version",
    "@prisma/fetch-engine",
    "@prisma/get-platform",
    "effect",
    "fast-check",
  ]);

  try {
    const output = execSync("npm ls prisma --all --parseable", {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });

    for (const line of output.trim().split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      const relative = path.relative(root, trimmed);
      const top = topLevelDir(relative);
      if (top) {
        packages.add(top);
      }
    }
  } catch (error) {
    const stdout =
      typeof error === "object" &&
      error !== null &&
      "stdout" in error &&
      typeof error.stdout === "string"
        ? error.stdout
        : "";

    for (const line of stdout.trim().split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      const relative = path.relative(root, trimmed);
      const top = topLevelDir(relative);
      if (top) {
        packages.add(top);
      }
    }
  }

  return [...packages].sort();
}

function copyPackage(name) {
  const src =
    name === ".prisma"
      ? path.join(root, "node_modules", ".prisma")
      : path.join(root, "node_modules", ...name.split("/"));

  if (!existsSync(src)) {
    console.warn(`skip missing prisma runtime package: ${name}`);
    return;
  }

  const dest = path.join(outDir, "node_modules", ...name.split("/"));
  mkdirSync(path.dirname(dest), { recursive: true });
  cpSync(src, dest, { recursive: true });
  console.log(`staged ${name}`);
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(path.join(outDir, "node_modules"), { recursive: true });

for (const name of collectPackages()) {
  copyPackage(name);
}
