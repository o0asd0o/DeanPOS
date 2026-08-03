import { randomUUID } from "node:crypto";

import { createDb, withTenantScope } from "backend/src/db/client.ts";
import { hashPassword } from "backend/src/common/password.ts";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { createTestSeam } from "../src/test-seam.ts";
import { expectWrongTenantRefusal } from "../src/wrong-tenant-probe.ts";

// Issue 08: create, edit, and deactivate/reactivate a payment method, and its
// per-Store availability — `cash` stays immutable throughout.
const seam = createTestSeam();
const ownerDb = createDb({ databaseUrl: process.env.DATABASE_URI! });

const tenantA = randomUUID();
const tenantB = randomUUID();
const adminA = randomUUID();
const managerA = randomUUID();
const cashierA = randomUUID();
const adminB = randomUUID();
const storeA1 = randomUUID();
const storeA2 = randomUUID();
const cashA = randomUUID();
const cashB = randomUUID();
const methodB = randomUUID();
const storeB = randomUUID();

beforeAll(async () => {
  await ownerDb
    .insertInto("Tenant")
    .values([
      { id: tenantA, name: "Payment Methods Tenant A" },
      { id: tenantB, name: "Payment Methods Tenant B" },
    ])
    .execute();

  const passwordHash = await hashPassword("irrelevant");
  await ownerDb
    .insertInto("User")
    .values([
      {
        id: adminA,
        tenant_id: tenantA,
        email: `pm-admin-${randomUUID()}@pm.test`,
        password_hash: passwordHash,
        role: "admin",
      },
      {
        id: managerA,
        tenant_id: tenantA,
        email: `pm-manager-${randomUUID()}@pm.test`,
        password_hash: passwordHash,
        role: "manager",
      },
      {
        id: cashierA,
        tenant_id: tenantA,
        email: `pm-cashier-${randomUUID()}@pm.test`,
        password_hash: passwordHash,
        role: "cashier",
      },
      {
        id: adminB,
        tenant_id: tenantB,
        email: `pm-admin-b-${randomUUID()}@pm.test`,
        password_hash: passwordHash,
        role: "admin",
      },
    ])
    .execute();

  await withTenantScope(seam.db, tenantA, (db) =>
    db
      .insertInto("Store")
      .values([
        { id: storeA1, tenant_id: tenantA, name: "A Store 1" },
        { id: storeA2, tenant_id: tenantA, name: "A Store 2" },
      ])
      .execute(),
  );
  await withTenantScope(seam.db, tenantB, (db) =>
    db.insertInto("Store").values({ id: storeB, tenant_id: tenantB, name: "B Store" }).execute(),
  );

  await withTenantScope(seam.db, tenantA, (db) =>
    db
      .insertInto("PaymentMethod")
      .values({ id: cashA, tenant_id: tenantA, name: "Cash", kind: "cash" })
      .execute(),
  );
  await withTenantScope(seam.db, tenantB, async (db) => {
    await db
      .insertInto("PaymentMethod")
      .values({ id: cashB, tenant_id: tenantB, name: "Cash", kind: "cash" })
      .execute();
    await db
      .insertInto("PaymentMethod")
      .values({ id: methodB, tenant_id: tenantB, name: "B's GCash", kind: "recorded" })
      .execute();
  });
});

afterAll(async () => {
  await ownerDb
    .deleteFrom("PaymentMethodAudit")
    .where("tenant_id", "in", [tenantA, tenantB])
    .execute();
  await ownerDb
    .deleteFrom("PaymentMethodAvailability")
    .where("tenant_id", "in", [tenantA, tenantB])
    .execute();
  await ownerDb.deleteFrom("PaymentMethod").where("tenant_id", "in", [tenantA, tenantB]).execute();
  await ownerDb.deleteFrom("Store").where("tenant_id", "in", [tenantA, tenantB]).execute();
  await ownerDb.deleteFrom("User").where("tenant_id", "in", [tenantA, tenantB]).execute();
  await ownerDb.deleteFrom("Tenant").where("id", "in", [tenantA, tenantB]).execute();
  await ownerDb.destroy();
  await seam.db.destroy();
});

describe("paymentMethod.list", () => {
  it("an admin sees Cash plus every method in their own Tenant, never another Tenant's", async () => {
    const list = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.paymentMethod.list();

    expect(list.map((method) => method.id)).toContain(cashA);
    expect(list.map((method) => method.id)).not.toContain(cashB);
    expect(list.map((method) => method.id)).not.toContain(methodB);
  });

  it("a manager and a cashier are refused, server-side, and see nothing at all", async () => {
    const asManager = await seam.actors
      .asTenant(tenantA, { userId: managerA, role: "manager" })
      .client.paymentMethod.list();
    const asCashier = await seam.actors
      .asTenant(tenantA, { userId: cashierA, role: "cashier" })
      .client.paymentMethod.list();

    expect(asManager).toStrictEqual([]);
    expect(asCashier).toStrictEqual([]);
  });

  it("an unauthenticated caller sees nothing", async () => {
    const list = await seam.actors.asUnauthenticated().client.paymentMethod.list();
    expect(list).toStrictEqual([]);
  });

  it("wrong-tenant probe [paymentMethod.list]: Tenant B's method is readable as Tenant B, never in Tenant A's list", async () => {
    const listAsB = await seam.actors
      .asTenant(tenantB, { userId: randomUUID(), role: "admin" })
      .client.paymentMethod.list();
    expect(listAsB.map((method) => method.id)).toContain(methodB);
    const ownAsB = listAsB.find((method) => method.id === methodB);

    const listAsA = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.paymentMethod.list();
    expect(listAsA.map((method) => method.id)).not.toContain(methodB);
    const ownAsA = listAsA.find((method) => method.id === cashA);
    expect(ownAsA).toBeTruthy();

    await expectWrongTenantRefusal({
      path: "paymentMethod.list",
      mode: "confined",
      ownerSees: ownAsB,
      otherGets: async () => ownAsA,
      otherOwn: ownAsA,
    });
  });
});

describe("paymentMethod.create", () => {
  it("an admin creates a recorded method available at the chosen Stores", async () => {
    const created = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.paymentMethod.create({ name: "GCash", storeIds: [storeA1, storeA2] });

    expect(created?.name).toBe("GCash");
    expect(created?.kind).toBe("recorded");
    expect(created?.active).toBe(true);
    expect(new Set(created?.storeIds)).toStrictEqual(new Set([storeA1, storeA2]));

    // One `created` row plus one `available` row per Store checked.
    const audits = await withTenantScope(seam.db, tenantA, (db) =>
      db
        .selectFrom("PaymentMethodAudit")
        .selectAll()
        .where("payment_method_id", "=", created!.id)
        .execute(),
    );
    expect(audits).toHaveLength(3);
    expect(audits.filter((a) => a.field === "created")).toHaveLength(1);
    expect(audits.filter((a) => a.field === "available")).toHaveLength(2);
    expect(audits.find((a) => a.field === "created")?.old_value).toBeNull();

    await ownerDb
      .deleteFrom("PaymentMethodAudit")
      .where("payment_method_id", "=", created!.id)
      .execute();
    await ownerDb
      .deleteFrom("PaymentMethodAvailability")
      .where("payment_method_id", "=", created!.id)
      .execute();
    await ownerDb.deleteFrom("PaymentMethod").where("id", "=", created!.id).execute();
  });

  it("a manager and a cashier are refused, server-side", async () => {
    const asManager = await seam.actors
      .asTenant(tenantA, { userId: managerA, role: "manager" })
      .client.paymentMethod.create({ name: "Should Not Exist", storeIds: [] });
    const asCashier = await seam.actors
      .asTenant(tenantA, { userId: cashierA, role: "cashier" })
      .client.paymentMethod.create({ name: "Should Not Exist", storeIds: [] });

    expect(asManager).toBeNull();
    expect(asCashier).toBeNull();
  });

  it("wrong-tenant probe [paymentMethod.create]: Tenant A cannot create a method available at Tenant B's Store, and B's own create still succeeds", async () => {
    const createdAsB = await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.paymentMethod.create({ name: "B Cross-Tenant Probe", storeIds: [storeB] });
    expect(createdAsB?.storeIds).toStrictEqual([storeB]);

    const createdAsA = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.paymentMethod.create({ name: "A Own Create Probe", storeIds: [storeA1] });
    expect(createdAsA?.storeIds).toStrictEqual([storeA1]);

    const availabilityCountBefore = await ownerDb
      .selectFrom("PaymentMethodAvailability")
      .select((eb) => eb.fn.countAll<string>().as("count"))
      .where("tenant_id", "=", tenantA)
      .executeTakeFirstOrThrow();

    // The composite (tenant, store) FK on PaymentMethodAvailability rejects a
    // method offered at Tenant B's Store; the whole insert rolls back in the
    // same transaction — no method, no audit, no availability row.
    await expect(
      seam.actors.asTenant(tenantA, { userId: adminA, role: "admin" }).client.paymentMethod.create({
        name: "Should Not Exist Cross-Tenant",
        storeIds: [storeB],
      }),
    ).rejects.toThrow();

    const orphanedMethod = await ownerDb
      .selectFrom("PaymentMethod")
      .select("id")
      .where("name", "=", "Should Not Exist Cross-Tenant")
      .executeTakeFirst();
    expect(orphanedMethod).toBeUndefined();

    const availabilityCountAfter = await ownerDb
      .selectFrom("PaymentMethodAvailability")
      .select((eb) => eb.fn.countAll<string>().as("count"))
      .where("tenant_id", "=", tenantA)
      .executeTakeFirstOrThrow();
    expect(availabilityCountAfter.count).toBe(availabilityCountBefore.count);

    await expectWrongTenantRefusal({
      path: "paymentMethod.create",
      mode: "confined",
      ownerSees: createdAsB,
      otherGets: async () => createdAsA,
      otherOwn: createdAsA,
    });

    await ownerDb
      .deleteFrom("PaymentMethodAudit")
      .where("payment_method_id", "in", [createdAsB!.id, createdAsA!.id])
      .execute();
    await ownerDb
      .deleteFrom("PaymentMethodAvailability")
      .where("payment_method_id", "in", [createdAsB!.id, createdAsA!.id])
      .execute();
    await ownerDb
      .deleteFrom("PaymentMethod")
      .where("id", "in", [createdAsB!.id, createdAsA!.id])
      .execute();
  });
});

describe("paymentMethod.update", () => {
  it("renames a method and rewrites its availability, writing one audit row per changed pair", async () => {
    const created = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.paymentMethod.create({ name: "Maya", storeIds: [storeA1] });

    const updated = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.paymentMethod.update({ id: created!.id, name: "Maya Wallet", storeIds: [storeA2] });

    expect(updated?.name).toBe("Maya Wallet");
    expect(updated?.storeIds).toStrictEqual([storeA2]);

    const audits = await withTenantScope(seam.db, tenantA, (db) =>
      db
        .selectFrom("PaymentMethodAudit")
        .selectAll()
        .where("payment_method_id", "=", created!.id)
        .where("field", "in", ["name", "available"])
        .execute(),
    );
    // storeA1 removed, storeA2 added, plus the rename.
    expect(audits.filter((a) => a.field === "name")).toHaveLength(1);
    expect(audits.filter((a) => a.field === "available")).toHaveLength(3);

    await ownerDb
      .deleteFrom("PaymentMethodAudit")
      .where("payment_method_id", "=", created!.id)
      .execute();
    await ownerDb
      .deleteFrom("PaymentMethodAvailability")
      .where("payment_method_id", "=", created!.id)
      .execute();
    await ownerDb.deleteFrom("PaymentMethod").where("id", "=", created!.id).execute();
  });

  it("cash cannot be renamed", async () => {
    const result = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.paymentMethod.update({ id: cashA, name: "Renamed Cash", storeIds: [] });

    expect(result).toBeNull();
    const stillCash = await ownerDb
      .selectFrom("PaymentMethod")
      .select("name")
      .where("id", "=", cashA)
      .executeTakeFirstOrThrow();
    expect(stillCash.name).toBe("Cash");
  });

  it("a manager and a cashier are refused, server-side", async () => {
    const created = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.paymentMethod.create({ name: "Refusal Target", storeIds: [] });

    const asManager = await seam.actors
      .asTenant(tenantA, { userId: managerA, role: "manager" })
      .client.paymentMethod.update({ id: created!.id, name: "Hijacked", storeIds: [] });
    const asCashier = await seam.actors
      .asTenant(tenantA, { userId: cashierA, role: "cashier" })
      .client.paymentMethod.update({ id: created!.id, name: "Hijacked", storeIds: [] });

    expect(asManager).toBeNull();
    expect(asCashier).toBeNull();

    await ownerDb
      .deleteFrom("PaymentMethodAudit")
      .where("payment_method_id", "=", created!.id)
      .execute();
    await ownerDb.deleteFrom("PaymentMethod").where("id", "=", created!.id).execute();
  });

  it("wrong-tenant probe [paymentMethod.update]: Tenant A addressing Tenant B's method id is refused, B's row is untouched", async () => {
    const beforeAsB = await seam.actors
      .asTenant(tenantB, { userId: randomUUID(), role: "admin" })
      .client.paymentMethod.update({ id: methodB, name: "B's GCash", storeIds: [] });
    expect(beforeAsB?.name).toBe("B's GCash");

    await expectWrongTenantRefusal({
      path: "paymentMethod.update",
      mode: "refusal",
      ownerSees: beforeAsB,
      otherGets: () =>
        seam.actors
          .asTenant(tenantA, { userId: adminA, role: "admin" })
          .client.paymentMethod.update({ id: methodB, name: "Hijacked From A", storeIds: [] }),
    });

    const stillAsB = await ownerDb
      .selectFrom("PaymentMethod")
      .select("name")
      .where("id", "=", methodB)
      .executeTakeFirstOrThrow();
    expect(stillAsB.name).toBe("B's GCash");
  });
});

describe("paymentMethod.deactivate and paymentMethod.reactivate", () => {
  it("an admin deactivates, then reactivates — never a hard delete", async () => {
    const created = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.paymentMethod.create({ name: "Deactivate Me", storeIds: [] });

    const deactivated = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.paymentMethod.deactivate({ id: created!.id });
    expect(deactivated?.active).toBe(false);

    const stillReadable = await ownerDb
      .selectFrom("PaymentMethod")
      .select("id")
      .where("id", "=", created!.id)
      .executeTakeFirst();
    expect(stillReadable?.id).toBe(created!.id);

    const reactivated = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.paymentMethod.reactivate({ id: created!.id });
    expect(reactivated?.active).toBe(true);

    await ownerDb
      .deleteFrom("PaymentMethodAudit")
      .where("payment_method_id", "=", created!.id)
      .execute();
    await ownerDb.deleteFrom("PaymentMethod").where("id", "=", created!.id).execute();
  });

  it("cash cannot be deactivated", async () => {
    const result = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.paymentMethod.deactivate({ id: cashA });

    expect(result).toBeNull();
    const stillActive = await ownerDb
      .selectFrom("PaymentMethod")
      .select("active")
      .where("id", "=", cashA)
      .executeTakeFirstOrThrow();
    expect(stillActive.active).toBe(true);
  });

  it("a manager and a cashier are refused deactivation, server-side", async () => {
    const created = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.paymentMethod.create({ name: "Refuse Deactivate", storeIds: [] });

    const asManager = await seam.actors
      .asTenant(tenantA, { userId: managerA, role: "manager" })
      .client.paymentMethod.deactivate({ id: created!.id });
    const asCashier = await seam.actors
      .asTenant(tenantA, { userId: cashierA, role: "cashier" })
      .client.paymentMethod.deactivate({ id: created!.id });

    expect(asManager).toBeNull();
    expect(asCashier).toBeNull();

    await ownerDb
      .deleteFrom("PaymentMethodAudit")
      .where("payment_method_id", "=", created!.id)
      .execute();
    await ownerDb.deleteFrom("PaymentMethod").where("id", "=", created!.id).execute();
  });

  it("wrong-tenant probe [paymentMethod.deactivate]: Tenant A cannot deactivate Tenant B's method; B's row stays active", async () => {
    // Prove B's own read actually reaches the row before trusting A's
    // refusal to mean anything (finding 7).
    const ownAsB = await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.paymentMethod.update({ id: methodB, name: "B's GCash", storeIds: [] });
    expect(ownAsB?.id).toBe(methodB);

    await expectWrongTenantRefusal({
      path: "paymentMethod.deactivate",
      mode: "refusal",
      ownerSees: ownAsB,
      otherGets: () =>
        seam.actors
          .asTenant(tenantA, { userId: adminA, role: "admin" })
          .client.paymentMethod.deactivate({ id: methodB }),
    });

    const stillActive = await ownerDb
      .selectFrom("PaymentMethod")
      .select("active")
      .where("id", "=", methodB)
      .executeTakeFirstOrThrow();
    expect(stillActive.active).toBe(true);
  });

  it("wrong-tenant probe [paymentMethod.reactivate]: Tenant A cannot reactivate Tenant B's method; B's own reactivate still succeeds", async () => {
    const deactivatedAsB = await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.paymentMethod.deactivate({ id: methodB });
    expect(deactivatedAsB?.active).toBe(false);
    const reactivatedFirstAsB = await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.paymentMethod.reactivate({ id: methodB });
    expect(reactivatedFirstAsB?.active).toBe(true);
    const deactivatedAgainAsB = await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.paymentMethod.deactivate({ id: methodB });
    expect(deactivatedAgainAsB?.active).toBe(false);

    await expectWrongTenantRefusal({
      path: "paymentMethod.reactivate",
      mode: "refusal",
      ownerSees: reactivatedFirstAsB,
      otherGets: () =>
        seam.actors
          .asTenant(tenantA, { userId: adminA, role: "admin" })
          .client.paymentMethod.reactivate({ id: methodB }),
    });

    const stillInactive = await ownerDb
      .selectFrom("PaymentMethod")
      .select("active")
      .where("id", "=", methodB)
      .executeTakeFirstOrThrow();
    expect(stillInactive.active).toBe(false);

    const reactivatedAsB = await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.paymentMethod.reactivate({ id: methodB });
    expect(reactivatedAsB?.active).toBe(true);
  });
});

describe("per-Store availability", () => {
  it("is a positive join, current state only: removing a Store's availability removes it from the read side", async () => {
    const created = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.paymentMethod.create({ name: "Availability Check", storeIds: [storeA1, storeA2] });
    expect(new Set(created?.storeIds)).toStrictEqual(new Set([storeA1, storeA2]));

    const narrowed = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.paymentMethod.update({
        id: created!.id,
        name: "Availability Check",
        storeIds: [storeA1],
      });
    expect(narrowed?.storeIds).toStrictEqual([storeA1]);

    const list = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.paymentMethod.list();
    const row = list.find((method) => method.id === created!.id);
    expect(row?.storeIds).toStrictEqual([storeA1]);

    await ownerDb
      .deleteFrom("PaymentMethodAudit")
      .where("payment_method_id", "=", created!.id)
      .execute();
    await ownerDb
      .deleteFrom("PaymentMethodAvailability")
      .where("payment_method_id", "=", created!.id)
      .execute();
    await ownerDb.deleteFrom("PaymentMethod").where("id", "=", created!.id).execute();
  });

  it("cash holds no availability rows and is never returned by the join", async () => {
    const rows = await ownerDb
      .selectFrom("PaymentMethodAvailability")
      .selectAll()
      .where("payment_method_id", "=", cashA)
      .execute();
    expect(rows).toHaveLength(0);
  });
});

describe("PaymentMethodAudit isolation", () => {
  it("the wrong-tenant probe: an actor reads their own Tenant's audit rows, never another Tenant's", async () => {
    const createdAsB = await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.paymentMethod.create({ name: "Audit Isolation B", storeIds: [] });

    const ownerAuditsForB = await ownerDb
      .selectFrom("PaymentMethodAudit")
      .selectAll()
      .where("payment_method_id", "=", createdAsB!.id)
      .execute();
    expect(ownerAuditsForB.length).toBeGreaterThan(0);

    // Row-level security, not merely an empty result: the owner connection
    // proves the rows exist, so a scoped-as-A read of zero means hidden.
    const asAScoped = await withTenantScope(seam.db, tenantA, (db) =>
      db
        .selectFrom("PaymentMethodAudit")
        .selectAll()
        .where("payment_method_id", "=", createdAsB!.id)
        .execute(),
    );
    expect(asAScoped).toHaveLength(0);

    const asBScoped = await withTenantScope(seam.db, tenantB, (db) =>
      db
        .selectFrom("PaymentMethodAudit")
        .selectAll()
        .where("payment_method_id", "=", createdAsB!.id)
        .execute(),
    );
    expect(asBScoped).toHaveLength(ownerAuditsForB.length);

    await ownerDb
      .deleteFrom("PaymentMethodAudit")
      .where("payment_method_id", "=", createdAsB!.id)
      .execute();
    await ownerDb.deleteFrom("PaymentMethod").where("id", "=", createdAsB!.id).execute();
  });
});
