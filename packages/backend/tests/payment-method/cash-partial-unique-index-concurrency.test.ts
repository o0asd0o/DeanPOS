import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { createDb, type DatabaseInstance, withTenantScope } from "../../src/db/client.ts";
import { insertCashPaymentMethod } from "../../src/payment-method/db-operations/commands/insert-cash-payment-method.command.ts";

// Issue 08: the till can never be configured into a state where nothing can
// be sold — a second `kind: cash` method is refused by the database, proven
// with two genuinely concurrent attempts, not a sequential one.
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

describe("PaymentMethod_one_cash_per_tenant", () => {
  it("refuses a second concurrent `cash` insert for the same Tenant", async () => {
    // Fired together, not awaited one at a time — both attempts start before
    // either has committed, so the refusal comes from the partial unique
    // index, never from an application-level check-then-insert.
    const results = await Promise.allSettled([
      withTenantScope(appDb, tenantId, (db) =>
        insertCashPaymentMethod(db, { id: randomUUID(), tenantId }),
      ),
      withTenantScope(appDb, tenantId, (db) =>
        insertCashPaymentMethod(db, { id: randomUUID(), tenantId }),
      ),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(String((rejected[0] as PromiseRejectedResult).reason)).toMatch(
      /duplicate key|unique constraint/i,
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
