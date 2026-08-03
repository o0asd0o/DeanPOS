import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vite-plus/test";

// Grep proof for issue 10 (record 057 Q6, record 058): nothing logs a PIN
// or a PIN hash, the identifier itself only appears where it has to, and no
// server path authenticates with one.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const scanDirs = [
  join(repoRoot, "packages/backend/src"),
  join(repoRoot, "apps/api/src"),
  join(repoRoot, "apps/pos/src"),
  join(repoRoot, "packages/contract/src"),
];

function collectSourceFiles(path: string): string[] {
  if (!statSync(path).isDirectory()) return /\.tsx?$/.test(path) ? [path] : [];
  if (path.endsWith("/generated")) return [];
  return readdirSync(path).flatMap((entry) => collectSourceFiles(join(path, entry)));
}

const files = scanDirs.flatMap(collectSourceFiles);

// Files allowed to name `pinHash`/`pin_hash` (record 057 Q6) — the primitive,
// its schema, the migration/schema, the roster query, the set-PIN command,
// the roster accessor, the unlock screen, and tests.
const ALLOWED_PIN_HASH_FILES = [
  "packages/contract/src/pin.ts",
  "packages/contract/src/contract.ts",
  "packages/backend/src/db/prisma/schema.prisma",
  "packages/backend/src/device/db-operations/queries/get-pin-roster.query.ts",
  "packages/backend/src/device/handlers/pin-sync.ts",
  "packages/backend/src/user/db-operations/commands/set-user-pin.command.ts",
  "packages/backend/src/user/db-operations/commands/reset-user-pin.command.ts",
  "packages/backend/src/user/handlers/set-pin.ts",
  "apps/pos/src/lib/pin-roster.ts",
  "apps/pos/src/features/unlock",
];

// Every `console.<method>(` or `process.(stdout|stderr).write(` call site.
const SINK_OPEN = /(?:console\.\w+|process\.(?:stdout|stderr)\.write)\s*\(/g;

// From a sink's opening paren, walks forward tracking paren depth and
// skipping over string/template literals, to the full argument text —
// spanning however many lines the call actually takes. A single-line regex
// alone is defeated by `console.log(\n  pinHash,\n)`.
function loggingCallArgTexts(contents: string): string[] {
  const texts: string[] = [];
  for (const match of contents.matchAll(SINK_OPEN)) {
    const openIndex = match.index + match[0].length - 1;
    let depth = 0;
    let quote: string | null = null;
    let end = -1;
    for (let i = openIndex; i < contents.length; i++) {
      const char = contents[i];
      if (quote) {
        if (char === "\\") i++;
        else if (char === quote) quote = null;
        continue;
      }
      if (char === '"' || char === "'" || char === "`") {
        quote = char;
      } else if (char === "(") {
        depth++;
      } else if (char === ")") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end > openIndex) texts.push(contents.slice(openIndex + 1, end));
  }
  return texts;
}

// Every `verifyPin` named import specifier — the structural check that
// replaces throttling (record 058): no non-test server file compares a
// submitted PIN against a stored hash.
function importsVerifyPin(contents: string): boolean {
  for (const match of contents.matchAll(/import\s*\{([^}]*)\}\s*from/gs)) {
    const specifiers = match[1]!.split(",").map((s) =>
      s
        .trim()
        .split(/\s+as\s+/)[0]!
        .trim(),
    );
    if (specifiers.includes("verifyPin")) return true;
  }
  return false;
}

describe("no PIN or PIN hash logging", () => {
  it("no logging call anywhere in backend, api, pos, or contract mentions a PIN, in any argument, on any line", () => {
    const offenders = files.filter((file) =>
      loggingCallArgTexts(readFileSync(file, "utf8")).some((text) => /pin/i.test(text)),
    );
    expect(offenders).toStrictEqual([]);
  });

  it("pinHash / pin_hash appears only where it must", () => {
    const offenders = files.filter((file) => {
      const relative = file.slice(repoRoot.length + 1);
      const allowed = ALLOWED_PIN_HASH_FILES.some(
        (entry) => relative === entry || relative.startsWith(`${entry}/`),
      );
      if (allowed || /\.test\.tsx?$/.test(relative)) return false;
      const contents = readFileSync(file, "utf8");
      return /pinHash|pin_hash/.test(contents);
    });
    expect(offenders).toStrictEqual([]);
  });

  it("no non-test file under backend or api imports verifyPin (record 058)", () => {
    const offenders = [join(repoRoot, "packages/backend/src"), join(repoRoot, "apps/api/src")]
      .flatMap(collectSourceFiles)
      .filter((file) => !/\.test\.tsx?$/.test(file))
      .filter((file) => importsVerifyPin(readFileSync(file, "utf8")));
    expect(offenders).toStrictEqual([]);
  });
});
