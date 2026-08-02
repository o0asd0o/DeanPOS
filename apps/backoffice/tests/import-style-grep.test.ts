import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vite-plus/test";

// Code standard 8. Scoped to the three front-end apps: `packages/*` and
// `apps/api` are compiled by other workspaces, whose tsconfig would resolve
// `@/` against their own src.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const scanDirs = ["apps/backoffice", "apps/pos", "apps/landing"].flatMap((app) =>
  ["src", "tests"].map((dir) => join(repoRoot, app, dir)),
);

function collectSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      return entry === "node_modules" || entry === "generated" ? [] : collectSourceFiles(full);
    }
    return /\.tsx?$/.test(entry) ? [full] : [];
  });
}

describe("front-end import style", () => {
  it("imports app-internal modules as @/…, never by climbing out of a directory", () => {
    const offenders = scanDirs
      .filter((dir) => {
        try {
          return statSync(dir).isDirectory();
        } catch {
          return false;
        }
      })
      .flatMap(collectSourceFiles)
      .filter((file) => /(?:from|import\()\s*["']\.\.\//.test(readFileSync(file, "utf8")))
      .map((file) => relative(repoRoot, file));

    expect(offenders).toEqual([]);
  });
});
