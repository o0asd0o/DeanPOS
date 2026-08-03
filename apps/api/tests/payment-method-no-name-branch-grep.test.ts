import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vite-plus/test";

// Issue 08 acceptance criterion 5: `kind` is the only thing anything may
// branch on — never a method's `name`. Grep-based, not a type check, because
// nothing stops a string comparison from typechecking.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const thisFile = fileURLToPath(import.meta.url);
const scanDirs = ["apps", "packages"].map((dir) => join(repoRoot, dir));

function collectSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      return entry === "node_modules" ? [] : collectSourceFiles(full);
    }
    return /\.tsx?$/.test(entry) ? [full] : [];
  });
}

// Dot or bracket access to `name`, compared or destructured off a method —
// `existing.name !== input.name` stays allowed, since neither side is a
// literal, so it diffs old vs. new rather than branching on what the name IS.
const NAME_ACCESS = String.raw`(?:\.name|\[\s*["'\`]name["'\`]\s*\])`;
const NAME_BRANCH_PATTERNS = [
  new RegExp(`${NAME_ACCESS}\\s*(===|!==|==|!=)\\s*["'\`]`),
  new RegExp(`["'\`]\\s*(===|!==|==|!=)\\s*[\\w.]*${NAME_ACCESS}\\b`),
  new RegExp(`${NAME_ACCESS}\\.(includes|startsWith|endsWith|match)\\(`),
  new RegExp(`${NAME_ACCESS}\\s*\\.\\s*to(?:Lower|Upper)Case\\(\\)\\s*(===|!==|==|!=)`),
  new RegExp(
    `["'\`]\\s*(===|!==|==|!=)\\s*[\\w.]*${NAME_ACCESS}\\s*\\.\\s*to(?:Lower|Upper)Case\\(\\)`,
  ),
  /\b(?:const|let)\s*\{\s*name\b[^}]*\}\s*=\s*[\w.]*[Mm]ethod\b/,
];

describe("payment methods never branch on a method's name", () => {
  it("greps clean across every TypeScript source in apps/ and packages/", () => {
    const offenders = scanDirs
      .filter((dir) => {
        try {
          return statSync(dir).isDirectory();
        } catch {
          return false;
        }
      })
      .flatMap(collectSourceFiles)
      .filter((file) => file !== thisFile)
      .filter((file) => {
        const source = readFileSync(file, "utf8");
        return NAME_BRANCH_PATTERNS.some((pattern) => pattern.test(source));
      })
      .map((file) => relative(repoRoot, file));

    expect(offenders).toEqual([]);
  });
});
