import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vite-plus/test";

// Grep proof for issue 10 (record 057 Q6): nothing logs a PIN or a PIN
// hash, and the identifier itself only appears where it has to.
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

const LOGGING_SINK_LINE = /(console\.|process\.(stdout|stderr)\.write)[^\n]*/g;

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
  "packages/backend/src/user/db-operations/queries/find-user-pin-hash.query.ts",
  "packages/backend/src/user/handlers/set-pin.ts",
  "apps/pos/src/lib/pin-roster.ts",
  "apps/pos/src/features/unlock",
];

describe("no PIN or PIN hash logging", () => {
  it("no log call anywhere in backend, api, pos, or contract mentions a PIN", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const contents = readFileSync(file, "utf8");
      const matches = contents.match(LOGGING_SINK_LINE) ?? [];
      if (matches.some((line) => /pin/i.test(line))) offenders.push(file);
    }
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
});
