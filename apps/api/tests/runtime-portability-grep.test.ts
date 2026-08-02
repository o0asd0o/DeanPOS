import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vite-plus/test";

// Grep proof for record 028: no runtime branch on Bun. The API runs under
// bun in production (docker/api.Dockerfile) and under node in tests, so a
// `Bun.` call is a path only one of the two runtimes ever executes.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const scanDirs = [join(repoRoot, "packages/backend/src"), join(repoRoot, "apps/api/src")];

function collectSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) return collectSourceFiles(fullPath);
    return /\.tsx?$/.test(fullPath) ? [fullPath] : [];
  });
}

const files = scanDirs.flatMap(collectSourceFiles);

describe("runtime portability grep proof", () => {
  it("never references the Bun global", () => {
    const offenders = files.filter((f) => /\bBun\./.test(readFileSync(f, "utf8")));

    expect(offenders).toStrictEqual([]);
  });
});
