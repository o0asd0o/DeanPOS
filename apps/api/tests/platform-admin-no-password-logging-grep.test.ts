import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vite-plus/test";

// Grep proof for issue 02 acceptance criteria: nothing in the provisioning
// path or the password module logs anything at all, so a password, a
// password hash, or the temporary password can never reach a log.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const scanDirs = [
  join(repoRoot, "packages/backend/src/platform-admin"),
  join(repoRoot, "packages/backend/src/common/password.ts"),
  join(repoRoot, "apps/api/src/routes/platform-admin.ts"),
];

function collectSourceFiles(path: string): string[] {
  if (!statSync(path).isDirectory()) return /\.tsx?$/.test(path) ? [path] : [];
  return readdirSync(path).flatMap((entry) => collectSourceFiles(join(path, entry)));
}

const files = scanDirs.flatMap(collectSourceFiles);

// Every logging sink this codebase actually has today (no logger dependency
// exists yet) — console.* and a direct write to stdout/stderr.
const LOGGING_SINK = /console\.|process\.(stdout|stderr)\.write/;

describe("platform-admin provisioning: no password logging", () => {
  it("contains no logging call anywhere in the provisioning or password-hashing path", () => {
    const offenders = files.filter((f) => LOGGING_SINK.test(readFileSync(f, "utf8")));

    expect(offenders).toStrictEqual([]);
  });
});
