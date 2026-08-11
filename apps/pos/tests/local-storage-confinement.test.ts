import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vite-plus/test";

// Record 059 Q3: localStorage stays behind dedicated accessor modules.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const srcRoot = join(repoRoot, "apps/pos/src");

const ALLOWED = [
  "device-token.ts",
  "draft-store.ts",
  "order-number-sequence.ts",
  "pin-roster.ts",
  "pin-throttle.ts",
  "view-mode.ts",
];

function collectSourceFiles(path: string): string[] {
  if (!statSync(path).isDirectory()) return /\.tsx?$/.test(path) ? [path] : [];
  return readdirSync(path).flatMap((entry) => collectSourceFiles(join(path, entry)));
}

describe("localStorage confinement", () => {
  it("only dedicated POS storage accessors mention localStorage", () => {
    const offenders = collectSourceFiles(srcRoot)
      .filter((file) => /localStorage/.test(readFileSync(file, "utf8")))
      .map((file) => basename(file))
      .sort();
    expect(offenders).toStrictEqual([...ALLOWED].sort());
  });
});
