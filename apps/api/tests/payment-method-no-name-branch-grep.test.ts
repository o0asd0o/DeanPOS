import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vite-plus/test";

// Issue 08 acceptance criterion 5: `kind` is the only thing anything may
// branch on — never a method's `name`. Grep-based, not a type check, because
// nothing stops a string comparison from typechecking.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const scanDirs = [
  "packages/backend/src/payment-method",
  "packages/backend/src/platform-admin",
  "apps/api/src/routes",
  "apps/backoffice/src/features/payment-methods",
].map((dir) => join(repoRoot, dir));

function collectSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      return entry === "node_modules" ? [] : collectSourceFiles(full);
    }
    return /\.tsx?$/.test(entry) ? [full] : [];
  });
}

// Matches a name compared against a string literal — `.name === "Cash"`,
// `name.includes("GCash")` — while allowing `existing.name !== input.name`,
// which diffs old vs. new for change detection, not a business branch on
// what the name IS.
const NAME_BRANCH =
  /\.name\s*(===|!==|==|!=)\s*["'`]|["'`]\s*(===|!==|==|!=)\s*[\w.]*\.name\b|\.name\.(includes|startsWith|endsWith|match)\(/;

describe("payment methods never branch on a method's name", () => {
  it("greps clean across the payment-method handlers, routes, and UI", () => {
    const offenders = scanDirs
      .filter((dir) => {
        try {
          return statSync(dir).isDirectory();
        } catch {
          return false;
        }
      })
      .flatMap(collectSourceFiles)
      .filter((file) => NAME_BRANCH.test(readFileSync(file, "utf8")))
      .map((file) => relative(repoRoot, file));

    expect(offenders).toEqual([]);
  });
});
