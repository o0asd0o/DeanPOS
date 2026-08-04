import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vite-plus/test";

// Grep proof for issue 14 acceptance criterion 9: the audit stores a hash
// triple, never the bytes (record 066 Q6) — an append-only table that grows
// an image column can never have that mistake corrected.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const schema = readFileSync(join(repoRoot, "packages/backend/src/db/prisma/schema.prisma"), "utf8");

const modelMatch = schema.match(/model PaymentMethodAudit \{([\s\S]*?)\n\}/);

describe("PaymentMethodAudit carries no binary column", () => {
  it("the model exists and has no Bytes-typed field", () => {
    expect(modelMatch).not.toBeNull();
    const body = modelMatch![1]!;
    expect(/\bBytes\b/.test(body)).toBe(false);
  });
});
