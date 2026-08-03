import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { sql } from "kysely";

import { createDb, type DatabaseInstance, withTenantScope } from "../../src/db/client.ts";
import { insertCashPaymentMethod } from "../../src/payment-method/db-operations/commands/insert-cash-payment-method.command.ts";

// Issue 08: the till can never be configured into a state where nothing can
// be sold — a second `kind: cash` method is refused by the database, proven
// by holding the first insert open, uncommitted, until the second is
// confirmed queued behind it, not by racing two promises and hoping they
// overlap.
const ownerDb: DatabaseInstance = createDb({ databaseUrl: process.env.DATABASE_URI! });
const appDb: DatabaseInstance = createDb({ databaseUrl: process.env.APP_DATABASE_URI! });

const tenantId = randomUUID();

beforeAll(async () => {
  await ownerDb.insertInto("Tenant").values({ id: tenantId, name: "Cash Race Tenant" }).execute();
});

afterAll(async () => {
  await ownerDb.deleteFrom("PaymentMethod").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Tenant").where("id", "=", tenantId).execute();
  await ownerDb.destroy();
  await appDb.destroy();
});

// Polls pg_stat_activity rather than sleeping: waits until the second insert
// is actually blocked behind the first's uncommitted `cash` row.
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
    `timed out waiting for ${expected} backend(s) blocked on the PaymentMethod insert`,
  );
};

// Settled into a plain value immediately, in the same tick the promise is
// created — a rejection can otherwise crash the run as unhandled before this
// test ever reaches `Promise.all`.
const toSettled = <T>(promise: Promise<T>) =>
  promise.then(
    (value) => ({ status: "fulfilled" as const, value }),
    (reason) => ({ status: "rejected" as const, reason }),
  );

describe("PaymentMethod_one_cash_per_tenant", () => {
  it("refuses a second `cash` insert issued while the first is still uncommitted", async () => {
    let releaseFirst!: () => void;
    const firstReleased = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let signalInserted!: () => void;
    const firstInserted = new Promise<void>((resolve) => {
      signalInserted = resolve;
    });

    // Held open past its INSERT: the second attempt below is only issued
    // once this row's uncommitted index entry is confirmed to exist, so it
    // is guaranteed to queue behind it rather than race it.
    const first = toSettled(
      withTenantScope(appDb, tenantId, async (db) => {
        await insertCashPaymentMethod(db, { id: randomUUID(), tenantId });
        signalInserted();
        await firstReleased;
      }),
    );

    await firstInserted;
    const second = toSettled(
      withTenantScope(appDb, tenantId, (db) =>
        insertCashPaymentMethod(db, { id: randomUUID(), tenantId }),
      ),
    );
    await waitForBlockedBackends(1);

    releaseFirst();
    const results = await Promise.all([first, second]);

    expect(results[0]!.status).toBe("fulfilled");
    expect(results[1]!.status).toBe("rejected");
    expect(String((results[1] as { status: "rejected"; reason: unknown }).reason)).toMatch(
      /PaymentMethod_one_cash_per_tenant/,
    );

    const rows = await ownerDb
      .selectFrom("PaymentMethod")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("kind", "=", "cash")
      .execute();
    expect(rows).toHaveLength(1);
  });
});
