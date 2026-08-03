import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { hashPassword } from "../../src/common/password.ts";
import type { Ctx } from "../../src/common/ctx.ts";
import { createDb, type DatabaseInstance, withTenantScope } from "../../src/db/client.ts";
import { handler as updateTenantSettings } from "../../src/tenant-settings/handlers/update-tenant-settings.ts";

// Round-1 finding 1: the pre-update read must lock the Tenant row (record
// 034's pattern), or two concurrent saves both diff against the same
// pre-image and the audit chain silently drops the middle transition.
const ownerDb: DatabaseInstance = createDb({ databaseUrl: process.env.DATABASE_URI! });
const appDb: DatabaseInstance = createDb({ databaseUrl: process.env.APP_DATABASE_URI! });

const tenantId = randomUUID();
const userId = randomUUID();

beforeAll(async () => {
  await ownerDb.insertInto("Tenant").values({ id: tenantId, name: "Concurrency Tenant" }).execute();
  await ownerDb
    .insertInto("User")
    .values({
      id: userId,
      tenant_id: tenantId,
      email: `concurrency-${randomUUID()}@settings.test`,
      password_hash: await hashPassword("irrelevant"),
      role: "admin",
    })
    .execute();
  await ownerDb
    .updateTable("Tenant")
    .set({ vat_rate_percent: 12 })
    .where("id", "=", tenantId)
    .execute();
});

afterAll(async () => {
  await ownerDb.deleteFrom("TenantSettingsAudit").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("User").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Tenant").where("id", "=", tenantId).execute();
  await ownerDb.destroy();
  await appDb.destroy();
});

const baseInput = {
  timezone: "Asia/Manila" as const,
  vatEnabled: false,
  varianceToleranceCentavos: 0,
  cashMovementOverrideThresholdCentavos: 0,
};

const ctx: Ctx = {
  db: appDb,
  clientIp: "127.0.0.1",
  kind: "tenant",
  principal: { tenantId, userId, role: "admin" },
};

describe("update-tenant-settings: concurrent saves form an unbroken audit chain", () => {
  it("12->13 and 13->14 both appear, with no gap and no duplicate old_value", async () => {
    // Both start from vatRatePercent = 12, released together — the pre-fix
    // unlocked read lets both diff against 12, producing 12->13 and 12->14
    // instead of 12->13 and 13->14.
    await Promise.all([
      updateTenantSettings({ ctx, input: { ...baseInput, vatRatePercent: 13 } }),
      updateTenantSettings({ ctx, input: { ...baseInput, vatRatePercent: 14 } }),
    ]);

    const rows = await withTenantScope(appDb, tenantId, (db) =>
      db
        .selectFrom("TenantSettingsAudit")
        .selectAll()
        .where("tenant_id", "=", tenantId)
        .where("setting", "=", "vatRatePercent")
        .orderBy("created_at", "asc")
        .execute(),
    );

    expect(rows).toHaveLength(2);
    const oldValues = rows.map((row) => row.old_value).sort();
    const newValues = rows.map((row) => row.new_value).sort();
    expect(oldValues).toEqual(["12", "13"]);
    expect(newValues).toEqual(["13", "14"]);
  });
});
