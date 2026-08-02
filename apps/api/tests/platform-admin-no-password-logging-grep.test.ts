import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vite-plus/test";

// Grep proof for issue 02 and issue 03: nothing in these paths logs
// anything, so a password, hash, or session id can never reach a log.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const scanDirs = [
  join(repoRoot, "packages/backend/src/platform-admin"),
  join(repoRoot, "packages/backend/src/auth"),
  join(repoRoot, "packages/backend/src/common/password.ts"),
  join(repoRoot, "apps/api/src/routes/platform-admin.ts"),
  join(repoRoot, "apps/api/src/routes/auth.ts"),
  join(repoRoot, "apps/api/src/context.ts"),
  join(repoRoot, "apps/api/src/cookies.ts"),
];

function collectSourceFiles(path: string): string[] {
  if (!statSync(path).isDirectory()) return /\.tsx?$/.test(path) ? [path] : [];
  return readdirSync(path).flatMap((entry) => collectSourceFiles(join(path, entry)));
}

const files = scanDirs.flatMap(collectSourceFiles);

// Every logging sink this codebase actually has today (no logger dependency
// exists yet) — console.* and a direct write to stdout/stderr.
const LOGGING_SINK = /console\.|process\.(stdout|stderr)\.write/;

describe("no password or session id logging", () => {
  it("contains no logging call anywhere in the provisioning, sign-in, or password-hashing path", () => {
    const offenders = files.filter((f) => LOGGING_SINK.test(readFileSync(f, "utf8")));

    expect(offenders).toStrictEqual([]);
  });
});
