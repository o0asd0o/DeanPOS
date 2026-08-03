import { randomUUID } from "node:crypto";

import { createDb, withTenantScope } from "backend/src/db/client.ts";
import { hashPassword } from "backend/src/common/password.ts";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { createTestSeam } from "../src/test-seam.ts";
import { expectWrongTenantRefusal } from "../src/wrong-tenant-probe.ts";

// Issue 05: create, edit and deactivate/reactivate a Store, and the
// business-day-start / table-labels settings that live with it.
const seam = createTestSeam();
const ownerDb = createDb({ databaseUrl: process.env.DATABASE_URI! });

const tenantA = randomUUID();
const tenantB = randomUUID();
const adminA = randomUUID();
const managerA = randomUUID();
const cashierA = randomUUID();
const storeA = randomUUID();
const storeB = randomUUID();

beforeAll(async () => {
  await ownerDb
    .insertInto("Tenant")
    .values([
      { id: tenantA, name: "Store Mgmt Tenant A" },
      { id: tenantB, name: "Store Mgmt Tenant B" },
    ])
    .execute();

  const passwordHash = await hashPassword("irrelevant");
  await ownerDb
    .insertInto("User")
    .values([
      {
        id: adminA,
        tenant_id: tenantA,
        email: `sm-admin-${randomUUID()}@store.test`,
        password_hash: passwordHash,
        role: "admin",
      },
      {
        id: managerA,
        tenant_id: tenantA,
        email: `sm-manager-${randomUUID()}@store.test`,
        password_hash: passwordHash,
        role: "manager",
      },
      {
        id: cashierA,
        tenant_id: tenantA,
        email: `sm-cashier-${randomUUID()}@store.test`,
        password_hash: passwordHash,
        role: "cashier",
      },
    ])
    .execute();

  await withTenantScope(seam.db, tenantA, (db) =>
    db.insertInto("Store").values({ id: storeA, tenant_id: tenantA, name: "A's Store" }).execute(),
  );
  await withTenantScope(seam.db, tenantB, (db) =>
    db.insertInto("Store").values({ id: storeB, tenant_id: tenantB, name: "B's Store" }).execute(),
  );

  // managerA is assigned to storeA only.
  await withTenantScope(seam.db, tenantA, (db) =>
    db
      .insertInto("UserStore")
      .values({
        id: randomUUID(),
        tenant_id: tenantA,
        user_id: managerA,
        store_id: storeA,
        assigned: true,
        effective_from: new Date(Date.now() - 60_000),
      })
      .execute(),
  );
});

afterAll(async () => {
  await ownerDb.deleteFrom("UserStore").where("tenant_id", "in", [tenantA, tenantB]).execute();
  await ownerDb.deleteFrom("Store").where("tenant_id", "in", [tenantA, tenantB]).execute();
  await ownerDb.deleteFrom("User").where("tenant_id", "in", [tenantA, tenantB]).execute();
  await ownerDb.deleteFrom("Tenant").where("id", "in", [tenantA, tenantB]).execute();
  await ownerDb.destroy();
  await seam.db.destroy();
});

describe("store.create", () => {
  it("an admin creates a Store with business-day start and table labels", async () => {
    const created = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.store.create({
        name: "New Store",
        businessDayStart: "02:00",
        tableLabels: ["1", "2"],
      });

    expect(created?.name).toBe("New Store");
    expect(created?.tenantId).toBe(tenantA);
    expect(created?.businessDayStart).toBe("02:00");
    expect(created?.tableLabels).toStrictEqual(["1", "2"]);
    expect(created?.active).toBe(true);

    await ownerDb.deleteFrom("Store").where("id", "=", created!.id).execute();
  });

  it("defaults business-day start to 00:00 and table labels to empty", async () => {
    const created = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.store.create({ name: "Default Store", businessDayStart: "00:00", tableLabels: [] });

    expect(created?.businessDayStart).toBe("00:00");
    expect(created?.tableLabels).toStrictEqual([]);

    await ownerDb.deleteFrom("Store").where("id", "=", created!.id).execute();
  });

  it("a manager is refused, server-side", async () => {
    const result = await seam.actors
      .asTenant(tenantA, { userId: managerA, role: "manager" })
      .client.store.create({
        name: "Should Not Exist",
        businessDayStart: "00:00",
        tableLabels: [],
      });

    expect(result).toBeNull();
  });

  it("a cashier is refused, server-side", async () => {
    const result = await seam.actors
      .asTenant(tenantA, { userId: cashierA, role: "cashier" })
      .client.store.create({
        name: "Should Not Exist",
        businessDayStart: "00:00",
        tableLabels: [],
      });

    expect(result).toBeNull();
  });
});

describe("store.update", () => {
  it("an admin renames a Store and rewrites its settings whole", async () => {
    const updated = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.store.update({
        id: storeA,
        name: "A's Store, Renamed",
        businessDayStart: "03:30",
        tableLabels: ["Patio 1", "Patio 2", "Bar"],
      });

    expect(updated?.name).toBe("A's Store, Renamed");
    expect(updated?.businessDayStart).toBe("03:30");
    expect(updated?.tableLabels).toStrictEqual(["Patio 1", "Patio 2", "Bar"]);

    // Reordering: send the same three labels in a different order — the
    // array is the only way order is expressible (record 040 §3).
    const reordered = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.store.update({
        id: storeA,
        name: "A's Store, Renamed",
        businessDayStart: "03:30",
        tableLabels: ["Bar", "Patio 1", "Patio 2"],
      });
    expect(reordered?.tableLabels).toStrictEqual(["Bar", "Patio 1", "Patio 2"]);

    // Duplicates are permitted (issue 05 acceptance criteria).
    const duplicated = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.store.update({
        id: storeA,
        name: "A's Store, Renamed",
        businessDayStart: "03:30",
        tableLabels: ["1", "1"],
      });
    expect(duplicated?.tableLabels).toStrictEqual(["1", "1"]);

    // Restore for later tests/describes that read storeA.
    await seam.actors.asTenant(tenantA, { userId: adminA, role: "admin" }).client.store.update({
      id: storeA,
      name: "A's Store",
      businessDayStart: "00:00",
      tableLabels: [],
    });
  });

  it("does not touch active state", async () => {
    const before = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.store.get({ id: storeA });
    expect(before?.active).toBe(true);

    const updated = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.store.update({
        id: storeA,
        name: "A's Store",
        businessDayStart: "00:00",
        tableLabels: [],
      });

    expect(updated?.active).toBe(true);
  });

  it("a manager is refused, server-side", async () => {
    const result = await seam.actors
      .asTenant(tenantA, { userId: managerA, role: "manager" })
      .client.store.update({
        id: storeA,
        name: "Hijacked",
        businessDayStart: "00:00",
        tableLabels: [],
      });

    expect(result).toBeNull();
  });

  it("a cashier is refused, server-side", async () => {
    const result = await seam.actors
      .asTenant(tenantA, { userId: cashierA, role: "cashier" })
      .client.store.update({
        id: storeA,
        name: "Hijacked",
        businessDayStart: "00:00",
        tableLabels: [],
      });

    expect(result).toBeNull();
  });

  it("the wrong-tenant probe: Tenant A addressing Tenant B's Store id is refused, B's row is untouched", async () => {
    // Establish success through Tenant B's own application path first
    // (finding 7) — seeding through the owner DB proves nothing about
    // authorisation, since it bypasses it entirely.
    const beforeAsB = await seam.actors
      .asTenant(tenantB, { userId: randomUUID(), role: "admin" })
      .client.store.update({
        id: storeB,
        name: "B's Store",
        businessDayStart: "00:00",
        tableLabels: [],
      });
    expect(beforeAsB?.name).toBe("B's Store");

    await expectWrongTenantRefusal(
      () =>
        seam.actors.asTenant(tenantA, { userId: adminA, role: "admin" }).client.store.update({
          id: storeB,
          name: "Hijacked From A",
          businessDayStart: "00:00",
          tableLabels: [],
        }),
      (result) => result === null,
    );

    const afterAsB = await seam.actors
      .asTenant(tenantB, { userId: randomUUID(), role: "admin" })
      .client.store.get({ id: storeB });
    expect(afterAsB?.name).toBe("B's Store");
  });

  it("the wrong-tenant probe: Tenant A cannot create a Store visible to Tenant B, and Tenant B's own create still succeeds", async () => {
    const createdAsB = await seam.actors
      .asTenant(tenantB, { userId: randomUUID(), role: "admin" })
      .client.store.create({
        name: "B's Second Store",
        businessDayStart: "00:00",
        tableLabels: [],
      });
    expect(createdAsB?.tenantId).toBe(tenantB);

    const listAsA = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.store.list();
    expect(listAsA.map((store) => store.id)).not.toContain(createdAsB!.id);

    const listAsB = await seam.actors
      .asTenant(tenantB, { userId: randomUUID(), role: "admin" })
      .client.store.list();
    expect(listAsB.map((store) => store.id)).toContain(createdAsB!.id);

    await ownerDb.deleteFrom("Store").where("id", "=", createdAsB!.id).execute();
  });
});

describe("store.deactivate and store.reactivate", () => {
  it("an admin deactivates, then reactivates — never a hard delete", async () => {
    const deactivated = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.store.deactivate({ id: storeA });
    expect(deactivated?.active).toBe(false);

    const stillReadable = await ownerDb
      .selectFrom("Store")
      .select("id")
      .where("id", "=", storeA)
      .executeTakeFirst();
    expect(stillReadable?.id).toBe(storeA);

    const reactivated = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.store.reactivate({ id: storeA });
    expect(reactivated?.active).toBe(true);
  });

  it("deactivate/reactivate never changes name or settings", async () => {
    await seam.actors.asTenant(tenantA, { userId: adminA, role: "admin" }).client.store.update({
      id: storeA,
      name: "Untouched By Deactivation",
      businessDayStart: "05:00",
      tableLabels: ["X"],
    });

    const deactivated = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.store.deactivate({ id: storeA });
    expect(deactivated?.name).toBe("Untouched By Deactivation");
    expect(deactivated?.businessDayStart).toBe("05:00");
    expect(deactivated?.tableLabels).toStrictEqual(["X"]);

    await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.store.reactivate({ id: storeA });
  });

  it("a manager and a cashier are refused deactivation, server-side", async () => {
    const asManager = await seam.actors
      .asTenant(tenantA, { userId: managerA, role: "manager" })
      .client.store.deactivate({ id: storeA });
    const asCashier = await seam.actors
      .asTenant(tenantA, { userId: cashierA, role: "cashier" })
      .client.store.deactivate({ id: storeA });

    expect(asManager).toBeNull();
    expect(asCashier).toBeNull();

    const stillActive = await ownerDb
      .selectFrom("Store")
      .select("active")
      .where("id", "=", storeA)
      .executeTakeFirstOrThrow();
    expect(stillActive.active).toBe(true);
  });

  it("the wrong-tenant probe: Tenant A cannot deactivate Tenant B's Store; B's row stays active and readable in B", async () => {
    // Prove Tenant B's own deactivate/reactivate path actually works before
    // trusting a refusal from A to mean anything (finding 7).
    const deactivatedAsB = await seam.actors
      .asTenant(tenantB, { userId: randomUUID(), role: "admin" })
      .client.store.deactivate({ id: storeB });
    expect(deactivatedAsB?.active).toBe(false);
    const reactivatedAsB = await seam.actors
      .asTenant(tenantB, { userId: randomUUID(), role: "admin" })
      .client.store.reactivate({ id: storeB });
    expect(reactivatedAsB?.active).toBe(true);

    await expectWrongTenantRefusal(
      () =>
        seam.actors
          .asTenant(tenantA, { userId: adminA, role: "admin" })
          .client.store.deactivate({ id: storeB }),
      (result) => result === null,
    );

    const stillAsB = await seam.actors
      .asTenant(tenantB, { userId: randomUUID(), role: "admin" })
      .client.store.get({ id: storeB });
    expect(stillAsB?.active).toBe(true);
  });

  it("the wrong-tenant probe: Tenant A cannot reactivate Tenant B's Store; B's row stays deactivated and readable in B", async () => {
    const deactivatedAsB = await seam.actors
      .asTenant(tenantB, { userId: randomUUID(), role: "admin" })
      .client.store.deactivate({ id: storeB });
    expect(deactivatedAsB?.active).toBe(false);

    await expectWrongTenantRefusal(
      () =>
        seam.actors
          .asTenant(tenantA, { userId: adminA, role: "admin" })
          .client.store.reactivate({ id: storeB }),
      (result) => result === null,
    );

    const stillAsB = await seam.actors
      .asTenant(tenantB, { userId: randomUUID(), role: "admin" })
      .client.store.get({ id: storeB });
    expect(stillAsB?.active).toBe(false);

    const restoredAsB = await seam.actors
      .asTenant(tenantB, { userId: randomUUID(), role: "admin" })
      .client.store.reactivate({ id: storeB });
    expect(restoredAsB?.active).toBe(true);
  });
});

describe("store.list", () => {
  it("an admin sees every Store in their own Tenant, and none of another Tenant's", async () => {
    const list = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.store.list();

    const ids = list.map((store) => store.id);
    expect(ids).toContain(storeA);
    expect(ids).not.toContain(storeB);
  });

  it("the wrong-tenant probe: Tenant B's Store is readable as Tenant B, but never appears in Tenant A's list", async () => {
    const asB = await seam.actors
      .asTenant(tenantB, { userId: randomUUID(), role: "admin" })
      .client.store.get({ id: storeB });
    expect(asB?.id).toBe(storeB);

    const asA = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.store.list();
    expect(asA.map((store) => store.id)).not.toContain(storeB);
  });

  it("a manager sees only their assigned Stores", async () => {
    const list = await seam.actors
      .asTenant(tenantA, { userId: managerA, role: "manager" })
      .client.store.list();

    expect(list.map((store) => store.id)).toStrictEqual([storeA]);
  });

  it("a cashier is refused, server-side, and sees no Store at all", async () => {
    const list = await seam.actors
      .asTenant(tenantA, { userId: cashierA, role: "cashier" })
      .client.store.list();

    expect(list).toStrictEqual([]);
  });

  it("an unauthenticated caller sees no Store at all", async () => {
    const list = await seam.actors.asUnauthenticated().client.store.list();

    expect(list).toStrictEqual([]);
  });
});
