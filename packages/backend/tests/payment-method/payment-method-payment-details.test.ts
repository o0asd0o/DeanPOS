import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { sql } from "kysely";

import { hashPassword } from "../../src/common/password.ts";
import { createDb, type DatabaseInstance, withTenantScope } from "../../src/db/client.ts";
import { getPaymentMethodPaymentDetails } from "../../src/payment-method/db-operations/queries/get-payment-method-payment-details.query.ts";
import { insertPaymentMethodPaymentDetails } from "../../src/payment-method/db-operations/commands/insert-payment-method-payment-details.command.ts";

// Issue 14, record 066's two database traps: partial-unique dedup and the
// `cash` trigger, plus whole-row resolution and tenant isolation on the
// new table.
const ownerDb: DatabaseInstance = createDb({ databaseUrl: process.env.DATABASE_URI! });
const appDb: DatabaseInstance = createDb({ databaseUrl: process.env.APP_DATABASE_URI! });

const tenantA = randomUUID();
const tenantB = randomUUID();
const userA = randomUUID();
const storeA = randomUUID();
const cashMethodA = randomUUID();
const recordedMethodA = randomUUID();
const recordedMethodB = randomUUID();

beforeAll(async () => {
  await ownerDb
    .insertInto("Tenant")
    .values([
      { id: tenantA, name: "PM Details Tenant A" },
      { id: tenantB, name: "PM Details Tenant B" },
    ])
    .execute();
  await ownerDb
    .insertInto("User")
    .values({
      id: userA,
      tenant_id: tenantA,
      email: `pm-details-a-${randomUUID()}@pm.test`,
      password_hash: await hashPassword("irrelevant"),
      role: "admin",
    })
    .execute();
  await ownerDb
    .insertInto("Store")
    .values({ id: storeA, tenant_id: tenantA, name: "Store A1" })
    .execute();
  await withTenantScope(ownerDb, tenantA, (db) =>
    db
      .insertInto("PaymentMethod")
      .values([
        { id: cashMethodA, tenant_id: tenantA, name: "Cash", kind: "cash" },
        { id: recordedMethodA, tenant_id: tenantA, name: "GCash", kind: "recorded" },
      ])
      .execute(),
  );
  await withTenantScope(ownerDb, tenantB, (db) =>
    db
      .insertInto("PaymentMethod")
      .values({ id: recordedMethodB, tenant_id: tenantB, name: "GCash", kind: "recorded" })
      .execute(),
  );
});

afterAll(async () => {
  await ownerDb
    .deleteFrom("PaymentMethodPaymentDetails")
    .where("tenant_id", "in", [tenantA, tenantB])
    .execute();
  await ownerDb.deleteFrom("PaymentMethod").where("tenant_id", "in", [tenantA, tenantB]).execute();
  await ownerDb.deleteFrom("Store").where("tenant_id", "=", tenantA).execute();
  await ownerDb.deleteFrom("User").where("tenant_id", "=", tenantA).execute();
  await ownerDb.deleteFrom("Tenant").where("id", "in", [tenantA, tenantB]).execute();
  await ownerDb.destroy();
  await appDb.destroy();
});

const waitForBlockedBackends = async (expected: number) => {
  for (let i = 0; i < 500; i++) {
    const { rows } = await sql<{ count: string }>`
      select count(*)::text as count
      from pg_stat_activity
      where wait_event_type = 'Lock'
        and query ilike '%"PaymentMethodPaymentDetails"%'
        and pid <> pg_backend_pid()
    `.execute(ownerDb);
    if (Number(rows[0]?.count ?? 0) >= expected) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("timed out waiting for blocked backends on PaymentMethodPaymentDetails");
};

const toSettled = <T>(promise: Promise<T>) =>
  promise.then(
    (value) => ({ status: "fulfilled" as const, value }),
    (reason) => ({ status: "rejected" as const, reason }),
  );

describe("PaymentMethodPaymentDetails_one_default_per_method", () => {
  it("refuses a second default (store_id null) row under two concurrent inserts", async () => {
    const methodId = randomUUID();
    await withTenantScope(ownerDb, tenantA, (db) =>
      db
        .insertInto("PaymentMethod")
        .values({ id: methodId, tenant_id: tenantA, name: "Maya", kind: "recorded" })
        .execute(),
    );

    let releaseFirst!: () => void;
    const firstReleased = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let signalInserted!: () => void;
    const firstInserted = new Promise<void>((resolve) => {
      signalInserted = resolve;
    });

    const first = toSettled(
      withTenantScope(appDb, tenantA, async (db) => {
        await insertPaymentMethodPaymentDetails(db, {
          id: randomUUID(),
          tenantId: tenantA,
          paymentMethodId: methodId,
          storeId: null,
          accountName: "Juan Dela Cruz",
          accountNumber: null,
          image: null,
        });
        signalInserted();
        await firstReleased;
      }),
    );

    await firstInserted;
    const second = toSettled(
      withTenantScope(appDb, tenantA, (db) =>
        insertPaymentMethodPaymentDetails(db, {
          id: randomUUID(),
          tenantId: tenantA,
          paymentMethodId: methodId,
          storeId: null,
          accountName: "Second Default",
          accountNumber: null,
          image: null,
        }),
      ),
    );
    await waitForBlockedBackends(1);

    releaseFirst();
    const results = await Promise.all([first, second]);

    expect(results[0]!.status).toBe("fulfilled");
    expect(results[1]!.status).toBe("rejected");
    expect(String((results[1] as { status: "rejected"; reason: unknown }).reason)).toMatch(
      /PaymentMethodPaymentDetails_one_default_per_method/,
    );

    const rows = await ownerDb
      .selectFrom("PaymentMethodPaymentDetails")
      .selectAll()
      .where("payment_method_id", "=", methodId)
      .execute();
    expect(rows).toHaveLength(1);
  });
});

describe("payment_method_payment_details_refuses_cash", () => {
  it("refuses an insert against a cash-kind method", async () => {
    await expect(
      withTenantScope(appDb, tenantA, (db) =>
        insertPaymentMethodPaymentDetails(db, {
          id: randomUUID(),
          tenantId: tenantA,
          paymentMethodId: cashMethodA,
          storeId: null,
          accountName: "Nope",
          accountNumber: null,
          image: null,
        }),
      ),
    ).rejects.toThrow(/cash payment method cannot hold payment details/);
  });
});

describe("whole-row resolution", () => {
  it("a Store override that sets only an image never inherits the Tenant default's account name", async () => {
    const image = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

    await withTenantScope(ownerDb, tenantA, (db) =>
      insertPaymentMethodPaymentDetails(db, {
        id: randomUUID(),
        tenantId: tenantA,
        paymentMethodId: recordedMethodA,
        storeId: null,
        accountName: "Tenant Default Name",
        accountNumber: null,
        image: null,
      }),
    );
    await withTenantScope(ownerDb, tenantA, (db) =>
      insertPaymentMethodPaymentDetails(db, {
        id: randomUUID(),
        tenantId: tenantA,
        paymentMethodId: recordedMethodA,
        storeId: storeA,
        accountName: null,
        accountNumber: null,
        image: { bytes: image, mime: "image/png", sha256: "deadbeef", byteLength: image.length },
      }),
    );

    const resolved =
      (await withTenantScope(ownerDb, tenantA, (db) =>
        getPaymentMethodPaymentDetails(db, recordedMethodA, storeA),
      )) ??
      (await withTenantScope(ownerDb, tenantA, (db) =>
        getPaymentMethodPaymentDetails(db, recordedMethodA, null),
      ));

    expect(resolved?.account_name).toBeNull();
    expect(resolved?.image_bytes).toEqual(image);
  });
});

describe("PaymentMethodPaymentDetails: tenant isolation", () => {
  it("deanpos_app scoped to Tenant A cannot see Tenant B's row", async () => {
    await withTenantScope(ownerDb, tenantB, (db) =>
      insertPaymentMethodPaymentDetails(db, {
        id: randomUUID(),
        tenantId: tenantB,
        paymentMethodId: recordedMethodB,
        storeId: null,
        accountName: "Tenant B Name",
        accountNumber: null,
        image: null,
      }),
    );

    const asA = await withTenantScope(appDb, tenantA, (db) =>
      db
        .selectFrom("PaymentMethodPaymentDetails")
        .selectAll()
        .where("payment_method_id", "=", recordedMethodB)
        .execute(),
    );
    expect(asA).toHaveLength(0);

    const asB = await withTenantScope(appDb, tenantB, (db) =>
      db
        .selectFrom("PaymentMethodPaymentDetails")
        .selectAll()
        .where("payment_method_id", "=", recordedMethodB)
        .execute(),
    );
    expect(asB).toHaveLength(1);
  });
});
