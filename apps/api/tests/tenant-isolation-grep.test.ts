import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vite-plus/test";

// Grep proof for issue 01 (tenant-isolation-spine) acceptance criteria: one
// `set_config` call site, one connection factory, and no client-controlled
// tenant read. Scoped to the two workspaces that can reach a database
// connection or a Ctx — packages/backend/src and apps/api/src.
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

describe("tenant isolation grep proofs", () => {
  it("calls set_config in exactly one file, and only transaction-local", () => {
    const callers = files.filter((f) => readFileSync(f, "utf8").includes("set_config("));

    expect(callers).toStrictEqual([join(repoRoot, "packages/backend/src/db/client.ts")]);

    const source = readFileSync(callers[0], "utf8");
    const calls = [...source.matchAll(/set_config\([^)]*\)/g)].map((m) => m[0]);
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) expect(call).toMatch(/,\s*true\s*\)$/);
  });

  it("never sets app.tenant_id with a bare SET, only via set_config(..., true)", () => {
    const offenders = files.filter((f) =>
      /\bSET\s+(LOCAL\s+)?app\.tenant_id\b/i.test(readFileSync(f, "utf8")),
    );

    expect(offenders).toStrictEqual([]);
  });

  it("constructs the connection pool in exactly one file", () => {
    const constructors = files.filter((f) => readFileSync(f, "utf8").includes("new Pool("));

    expect(constructors).toStrictEqual([join(repoRoot, "packages/backend/src/db/client.ts")]);
  });

  it("reads a tenant from the principal only, never a header, query param, body, or hostname", () => {
    const offenders = files.filter((filePath) =>
      readFileSync(filePath, "utf8")
        .split("\n")
        .some((line) => {
          const trimmed = line.trim();
          if (trimmed.startsWith("//") || trimmed.startsWith("*")) return false;
          const mentionsTenant = /tenant/i.test(trimmed);
          const mentionsClientInput =
            /\.header\(|\.query\(|\.param\(|hostname|subdomain|searchParams/i.test(trimmed);
          return mentionsTenant && mentionsClientInput;
        }),
    );

    expect(offenders).toStrictEqual([]);
  });
});
