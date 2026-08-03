import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { sql } from "kysely";

import { hashPassword } from "../../src/common/password.ts";
import type { Ctx } from "../../src/common/ctx.ts";
import { createDb, type DatabaseInstance, withTenantScope } from "../../src/db/client.ts";
import { handler as updateTenantSettings } from "../../src/tenant-settings/handlers/update-tenant-settings.ts";

// Record 034's diff-then-write locking pattern, applied to the Tenant row.
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

// Polls pg_stat_activity rather than sleeping: waits until `expected`
// backends are actually blocked on the Tenant row lock, so the barrier below
// is a fact about the database, not a guess about scheduling.
const waitForBlockedBackends = async (expected: number) => {
  for (let i = 0; i < 500; i++) {
    const { rows } = await sql<{ count: string }>`
      select count(*)::text as count
      from pg_stat_activity
      where wait_event_type = 'Lock'
        and query ilike '%"Tenant"%'
        and pid <> pg_backend_pid()
    `.execute(ownerDb);
    if (Number(rows[0]?.count ?? 0) >= expected) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`timed out waiting for ${expected} backend(s) blocked on the Tenant row lock`);
};

describe("update-tenant-settings: concurrent saves form an unbroken audit chain", () => {
  it("12->13 and 13->14 both appear, in that order, with no gap", async () => {
    // A held lock on the Tenant row forces both saves to queue behind it
    // before either is released — a real barrier on overlap, not a hope
    // that the runtime happens to interleave two unawaited promises.
    let releaseBarrier!: () => void;
    const barrierReleased = new Promise<void>((resolve) => {
      releaseBarrier = resolve;
    });
    const barrier = ownerDb.transaction().execute(async (trx) => {
      await sql`select id from "Tenant" where id = ${tenantId} for update`.execute(trx);
      await barrierReleased;
    });

    const save13 = updateTenantSettings({ ctx, input: { ...baseInput, vatRatePercent: 13 } });
    await waitForBlockedBackends(1);
    const save14 = updateTenantSettings({ ctx, input: { ...baseInput, vatRatePercent: 14 } });
    await waitForBlockedBackends(2);

    // Postgres grants a row lock's waiters in FIFO order, so releasing here
    // hands the lock to save13 first, then save14 — deterministically.
    releaseBarrier();
    await Promise.all([save13, save14, barrier]);

    const rows = await withTenantScope(appDb, tenantId, (db) =>
      db
        .selectFrom("TenantSettingsAudit")
        .selectAll()
        .where("tenant_id", "=", tenantId)
        .where("setting", "=", "vatRatePercent")
        .orderBy("created_at", "asc")
        .execute(),
    );

    expect(rows.map((row) => [row.old_value, row.new_value])).toEqual([
      ["12", "13"],
      ["13", "14"],
    ]);
  });
});
