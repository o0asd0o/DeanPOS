import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { sql } from "kysely";

import { hashPassword } from "../../src/common/password.ts";
import type { Ctx } from "../../src/common/ctx.ts";
import { createDb, type DatabaseInstance, withTenantScope } from "../../src/db/client.ts";
import { handler as updatePaymentMethod } from "../../src/payment-method/handlers/update-payment-method.ts";

// Record 034's diff-then-write locking pattern, applied to the PaymentMethod
// row (issues 06 and 07 both shipped this defect on their first pass).
const ownerDb: DatabaseInstance = createDb({ databaseUrl: process.env.DATABASE_URI! });
const appDb: DatabaseInstance = createDb({ databaseUrl: process.env.APP_DATABASE_URI! });

const tenantId = randomUUID();
const userId = randomUUID();
const methodId = randomUUID();

beforeAll(async () => {
  await ownerDb
    .insertInto("Tenant")
    .values({ id: tenantId, name: "Concurrency PM Tenant" })
    .execute();
  await ownerDb
    .insertInto("User")
    .values({
      id: userId,
      tenant_id: tenantId,
      email: `pm-concurrency-${randomUUID()}@pm.test`,
      password_hash: await hashPassword("irrelevant"),
      role: "admin",
    })
    .execute();
  await withTenantScope(ownerDb, tenantId, (db) =>
    db
      .insertInto("PaymentMethod")
      .values({ id: methodId, tenant_id: tenantId, name: "Name v1", kind: "recorded" })
      .execute(),
  );
});

afterAll(async () => {
  await ownerDb.deleteFrom("PaymentMethodAudit").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("PaymentMethod").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("User").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Tenant").where("id", "=", tenantId).execute();
  await ownerDb.destroy();
  await appDb.destroy();
});

const ctx: Ctx = {
  db: appDb,
  clientIp: "127.0.0.1",
  kind: "tenant",
  principal: { tenantId, userId, role: "admin" },
};

// Polls pg_stat_activity rather than sleeping: waits until `expected` backends
// are actually blocked on the PaymentMethod row lock.
const waitForBlockedBackends = async (expected: number) => {
  for (let i = 0; i < 500; i++) {
    const { rows } = await sql<{ count: string }>`
      select count(*)::text as count
      from pg_stat_activity
      where wait_event_type = 'Lock'
        and query ilike '%"PaymentMethod"%'
        and pid <> pg_backend_pid()
    `.execute(ownerDb);
    if (Number(rows[0]?.count ?? 0) >= expected) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(
    `timed out waiting for ${expected} backend(s) blocked on the PaymentMethod row lock`,
  );
};

describe("update-payment-method: concurrent saves form an unbroken audit chain", () => {
  it("v1->v2 and v2->v3 both appear, in that order, with no gap", async () => {
    let releaseBarrier!: () => void;
    const barrierReleased = new Promise<void>((resolve) => {
      releaseBarrier = resolve;
    });
    const barrier = ownerDb.transaction().execute(async (trx) => {
      await sql`select id from "PaymentMethod" where id = ${methodId} for update`.execute(trx);
      await barrierReleased;
    });

    const saveV2 = updatePaymentMethod({
      ctx,
      input: {
        id: methodId,
        name: "Name v2",
        storeIds: [],
        paymentDetails: { accountName: null, accountNumber: null },
      },
    });
    await waitForBlockedBackends(1);
    const saveV3 = updatePaymentMethod({
      ctx,
      input: {
        id: methodId,
        name: "Name v3",
        storeIds: [],
        paymentDetails: { accountName: null, accountNumber: null },
      },
    });
    await waitForBlockedBackends(2);

    // Postgres grants a row lock's waiters in FIFO order, so releasing here
    // hands the lock to saveV2 first, then saveV3 — deterministically.
    releaseBarrier();
    await Promise.all([saveV2, saveV3, barrier]);

    const rows = await withTenantScope(appDb, tenantId, (db) =>
      db
        .selectFrom("PaymentMethodAudit")
        .selectAll()
        .where("payment_method_id", "=", methodId)
        .where("field", "=", "name")
        .orderBy("created_at", "asc")
        .execute(),
    );

    expect(rows.map((row) => [row.old_value, row.new_value])).toEqual([
      ["Name v1", "Name v2"],
      ["Name v2", "Name v3"],
    ]);
  });
});
