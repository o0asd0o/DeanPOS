import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { sql } from "kysely";

import { hashPassword } from "../../src/common/password.ts";
import type { Ctx } from "../../src/common/ctx.ts";
import { createDb, type DatabaseInstance, withTenantScope } from "../../src/db/client.ts";
import { handler as deactivatePaymentMethod } from "../../src/payment-method/handlers/deactivate-payment-method.ts";
import { handler as reactivatePaymentMethod } from "../../src/payment-method/handlers/reactivate-payment-method.ts";

// Record 034's diff-then-write locking pattern, applied to deactivate and
// reactivate (issue 08 review S5) — both do a locked read-then-write whose
// audited `old_value` would be stale without the lock.
const ownerDb: DatabaseInstance = createDb({ databaseUrl: process.env.DATABASE_URI! });
const appDb: DatabaseInstance = createDb({ databaseUrl: process.env.APP_DATABASE_URI! });

const tenantId = randomUUID();
const userId = randomUUID();
const activeMethodId = randomUUID();
const inactiveMethodId = randomUUID();

beforeAll(async () => {
  await ownerDb
    .insertInto("Tenant")
    .values({ id: tenantId, name: "Deactivate/Reactivate Concurrency Tenant" })
    .execute();
  await ownerDb
    .insertInto("User")
    .values({
      id: userId,
      tenant_id: tenantId,
      email: `pm-deact-react-${randomUUID()}@pm.test`,
      password_hash: await hashPassword("irrelevant"),
      role: "admin",
    })
    .execute();
  await withTenantScope(ownerDb, tenantId, (db) =>
    db
      .insertInto("PaymentMethod")
      .values([
        { id: activeMethodId, tenant_id: tenantId, name: "Active Start", kind: "recorded" },
        {
          id: inactiveMethodId,
          tenant_id: tenantId,
          name: "Inactive Start",
          kind: "recorded",
          active: false,
        },
      ])
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

// Polls rather than sleeping, and follows the whole wait chain from this
// barrier: the second writer queues behind the first, not behind the barrier,
// so a direct `pg_blocking_pids` test never counts it.
const waitForBlockedBackends = async (blockerPid: number, expected: number) => {
  for (let i = 0; i < 500; i++) {
    const { rows } = await sql<{ count: string }>`
      with recursive blocked as (
        select pid from pg_stat_activity
        where pg_blocking_pids(pid) @> array[${blockerPid}]::int[]
        union
        select waiter.pid
        from pg_stat_activity waiter
        join blocked on pg_blocking_pids(waiter.pid) @> array[blocked.pid]::int[]
      )
      select count(*)::text as count from blocked
    `.execute(ownerDb);
    if (Number(rows[0]?.count ?? 0) >= expected) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`timed out waiting for ${expected} backend(s) blocked behind pid ${blockerPid}`);
};

// Locks the row, queues both handlers behind it, then releases — Postgres
// grants a row lock's waiters in FIFO order, so `first` always commits before
// `second` reads.
const raceUnderLock = async (
  id: string,
  first: () => Promise<unknown>,
  second: () => Promise<unknown>,
) => {
  let releaseBarrier!: () => void;
  const barrierReleased = new Promise<void>((resolve) => {
    releaseBarrier = resolve;
  });
  let announceBarrierPid!: (pid: number) => void;
  const barrierPid = new Promise<number>((resolve) => {
    announceBarrierPid = resolve;
  });
  const barrier = ownerDb.transaction().execute(async (trx) => {
    await sql`select id from "PaymentMethod" where id = ${id} for update`.execute(trx);
    const { rows } = await sql<{ pid: number }>`select pg_backend_pid() as pid`.execute(trx);
    announceBarrierPid(rows[0]!.pid);
    await barrierReleased;
  });

  const blockerPid = await barrierPid;
  const firstCall = first();
  await waitForBlockedBackends(blockerPid, 1);
  const secondCall = second();
  await waitForBlockedBackends(blockerPid, 2);

  releaseBarrier();
  await Promise.all([firstCall, secondCall, barrier]);
};

const auditTrail = (methodId: string) =>
  withTenantScope(appDb, tenantId, (db) =>
    db
      .selectFrom("PaymentMethodAudit")
      .selectAll()
      .where("payment_method_id", "=", methodId)
      .where("field", "=", "active")
      .orderBy("created_at", "asc")
      .execute(),
  );

describe("deactivate/reactivate: concurrent writers form an unbroken audit chain", () => {
  it("deactivate then reactivate — the second writer's old_value is the first's committed state", async () => {
    await raceUnderLock(
      activeMethodId,
      () => deactivatePaymentMethod({ ctx, input: { id: activeMethodId } }),
      () => reactivatePaymentMethod({ ctx, input: { id: activeMethodId } }),
    );

    const rows = await auditTrail(activeMethodId);
    expect(rows.map((row) => [row.old_value, row.new_value])).toEqual([
      ["true", "false"],
      ["false", "true"],
    ]);
  });

  it("reactivate then deactivate — the second writer's old_value is the first's committed state", async () => {
    await raceUnderLock(
      inactiveMethodId,
      () => reactivatePaymentMethod({ ctx, input: { id: inactiveMethodId } }),
      () => deactivatePaymentMethod({ ctx, input: { id: inactiveMethodId } }),
    );

    const rows = await auditTrail(inactiveMethodId);
    expect(rows.map((row) => [row.old_value, row.new_value])).toEqual([
      ["false", "true"],
      ["true", "false"],
    ]);
  });
});
