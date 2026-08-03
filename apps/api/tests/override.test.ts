import { randomUUID } from "node:crypto";

import { hashPassword } from "backend/src/common/password.ts";
import { createDb, withTenantScope } from "backend/src/db/client.ts";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { seedTenantUser } from "../src/seed-tenant-user.ts";
import { createTestSeam } from "../src/test-seam.ts";
import { expectWrongTenantRefusal } from "../src/wrong-tenant-probe.ts";

// Issue 12, record 060: terminal.recordOverride (Device-token) and
// override.list (criterion 8).
const seam = createTestSeam();
const ownerDb = createDb({ databaseUrl: process.env.DATABASE_URI! });

const tenantA = randomUUID();
const tenantB = randomUUID();
const adminA = randomUUID();
const managerA = randomUUID();
const cashierA = randomUUID();
const managerAOtherStore = randomUUID();
const adminB = randomUUID();
const storeA1 = randomUUID();
const storeA2 = randomUUID();
const storeB = randomUUID();

async function assignStore(tenantId: string, userId: string, storeId: string) {
  await withTenantScope(ownerDb, tenantId, (db) =>
    db
      .insertInto("UserStore")
      .values({
        id: randomUUID(),
        tenant_id: tenantId,
        user_id: userId,
        store_id: storeId,
        assigned: true,
        effective_from: new Date(Date.now() - 60_000),
      })
      .execute(),
  );
}

async function enrolDeviceAt(storeId: string, code: string, actor: string, tenantId: string) {
  const generated = await seam.actors
    .asTenant(tenantId, { userId: actor, role: "admin" })
    .client.device.generateCode({ storeId, name: "Override Terminal", code });
  if (!generated.ok) throw new Error("setup: generateCode failed");
  const exchanged = await seam.client.terminal.enrol({ secret: generated.secret });
  if (!exchanged.ok) throw new Error("setup: enrol failed");
  return exchanged;
}

beforeAll(async () => {
  await ownerDb
    .insertInto("Tenant")
    .values([
      { id: tenantA, name: "Override Tenant A" },
      { id: tenantB, name: "Override Tenant B" },
    ])
    .execute();

  const passwordHash = await hashPassword("irrelevant");
  await seedTenantUser(ownerDb, {
    id: adminA,
    tenantId: tenantA,
    email: `ov-admin-${randomUUID()}@ov.test`,
    passwordHash,
    role: "admin",
  });
  await seedTenantUser(ownerDb, {
    id: managerA,
    tenantId: tenantA,
    email: `ov-manager-${randomUUID()}@ov.test`,
    passwordHash,
    role: "manager",
  });
  await seedTenantUser(ownerDb, {
    id: cashierA,
    tenantId: tenantA,
    email: `ov-cashier-${randomUUID()}@ov.test`,
    passwordHash,
    role: "cashier",
  });
  await seedTenantUser(ownerDb, {
    id: managerAOtherStore,
    tenantId: tenantA,
    email: `ov-manager2-${randomUUID()}@ov.test`,
    passwordHash,
    role: "manager",
  });
  await seedTenantUser(ownerDb, {
    id: adminB,
    tenantId: tenantB,
    email: `ov-admin-b-${randomUUID()}@ov.test`,
    passwordHash,
    role: "admin",
  });

  await withTenantScope(ownerDb, tenantA, (db) =>
    db
      .insertInto("Store")
      .values([
        { id: storeA1, tenant_id: tenantA, name: "Override Store A1" },
        { id: storeA2, tenant_id: tenantA, name: "Override Store A2" },
      ])
      .execute(),
  );
  await withTenantScope(ownerDb, tenantB, (db) =>
    db
      .insertInto("Store")
      .values({ id: storeB, tenant_id: tenantB, name: "Override Store B" })
      .execute(),
  );

  await assignStore(tenantA, managerA, storeA1);
  await assignStore(tenantA, cashierA, storeA1);
  await assignStore(tenantA, managerAOtherStore, storeA2);
});

afterAll(async () => {
  await ownerDb
    .deleteFrom("OverrideConsumption")
    .where("tenant_id", "in", [tenantA, tenantB])
    .execute();
  await ownerDb.deleteFrom("Override").where("tenant_id", "in", [tenantA, tenantB]).execute();
  await ownerDb.deleteFrom("DeviceAudit").where("tenant_id", "in", [tenantA, tenantB]).execute();
  await ownerDb.deleteFrom("EnrolmentCode").where("tenant_id", "in", [tenantA, tenantB]).execute();
  await ownerDb.deleteFrom("Device").where("tenant_id", "in", [tenantA, tenantB]).execute();
  await ownerDb.deleteFrom("UserStore").where("tenant_id", "in", [tenantA, tenantB]).execute();
  await ownerDb.deleteFrom("UserRole").where("tenant_id", "in", [tenantA, tenantB]).execute();
  await ownerDb.deleteFrom("Store").where("tenant_id", "in", [tenantA, tenantB]).execute();
  await ownerDb.deleteFrom("User").where("tenant_id", "in", [tenantA, tenantB]).execute();
  await ownerDb.deleteFrom("Tenant").where("id", "in", [tenantA, tenantB]).execute();
  await ownerDb.destroy();
  await seam.db.destroy();
});

describe("terminal.recordOverride", () => {
  it("a manager assigned to the Device's Store is recorded, PIN never seen server-side", async () => {
    const device = await enrolDeviceAt(storeA1, "XA1", adminA, tenantA);
    const result = await seam.actors
      .asDevice({
        tenantId: tenantA,
        deviceId: device.deviceId,
        storeId: storeA1,
        code: "XA1",
        name: "t",
      })
      .client.terminal.recordOverride({
        approverUserId: managerA,
        actionType: "void_paid_order",
        reason: "Rung up in error",
        approvedAt: new Date(),
      });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const row = await withTenantScope(ownerDb, tenantA, (db) =>
      db.selectFrom("Override").selectAll().where("id", "=", result.overrideId).executeTakeFirst(),
    );
    expect(row?.approver_user_id).toBe(managerA);
    expect(row?.store_id).toBe(storeA1);
    expect(row?.device_id).toBe(device.deviceId);
    expect(row?.reason).toBe("Rung up in error");
  });

  it("a cashier named as approver is refused, whether or not a real PIN would match", async () => {
    const device = await enrolDeviceAt(storeA1, "XA2", adminA, tenantA);
    const result = await seam.actors
      .asDevice({
        tenantId: tenantA,
        deviceId: device.deviceId,
        storeId: storeA1,
        code: "XA2",
        name: "t",
      })
      .client.terminal.recordOverride({
        approverUserId: cashierA,
        actionType: "void_paid_order",
        reason: "Rung up in error",
        approvedAt: new Date(),
      });
    expect(result.ok).toBe(false);
  });

  it("a manager assigned to a different Store than the Device is refused", async () => {
    const device = await enrolDeviceAt(storeA1, "XA3", adminA, tenantA);
    const result = await seam.actors
      .asDevice({
        tenantId: tenantA,
        deviceId: device.deviceId,
        storeId: storeA1,
        code: "XA3",
        name: "t",
      })
      .client.terminal.recordOverride({
        approverUserId: managerAOtherStore,
        actionType: "void_paid_order",
        reason: "Rung up in error",
        approvedAt: new Date(),
      });
    expect(result.ok).toBe(false);
  });

  it("a claim predating the Device's own enrolment is refused", async () => {
    const device = await enrolDeviceAt(storeA1, "XA4", adminA, tenantA);
    const result = await seam.actors
      .asDevice({
        tenantId: tenantA,
        deviceId: device.deviceId,
        storeId: storeA1,
        code: "XA4",
        name: "t",
      })
      .client.terminal.recordOverride({
        approverUserId: managerA,
        actionType: "void_paid_order",
        reason: "Rung up in error",
        approvedAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
      });
    expect(result.ok).toBe(false);
  });

  it("without a Device token, the call is refused", async () => {
    const result = await seam.client.terminal.recordOverride({
      approverUserId: managerA,
      actionType: "void_paid_order",
      reason: "Rung up in error",
      approvedAt: new Date(),
    });
    expect(result.ok).toBe(false);
  });

  it("wrong-tenant probe: a Device token cannot mint an Override naming Tenant B's manager", async () => {
    const device = await enrolDeviceAt(storeA1, "XA5", adminA, tenantA);
    await expectWrongTenantRefusal(
      () =>
        seam.actors
          .asDevice({
            tenantId: tenantA,
            deviceId: device.deviceId,
            storeId: storeA1,
            code: "XA5",
            name: "t",
          })
          .client.terminal.recordOverride({
            approverUserId: adminB,
            actionType: "void_paid_order",
            reason: "Rung up in error",
            approvedAt: new Date(),
          }),
      (result) => result.ok === false,
    );
  });
});

describe("override.list", () => {
  it("criterion 8: admin sees the whole tenant; manager sees only assigned Stores; cashier is refused", async () => {
    const device = await enrolDeviceAt(storeA1, "XA6", adminA, tenantA);
    const recorded = await seam.actors
      .asDevice({
        tenantId: tenantA,
        deviceId: device.deviceId,
        storeId: storeA1,
        code: "XA6",
        name: "t",
      })
      .client.terminal.recordOverride({
        approverUserId: managerA,
        actionType: "refund",
        reason: "Customer changed their mind",
        approvedAt: new Date(),
      });
    if (!recorded.ok) throw new Error("setup failed");

    const asAdmin = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.override.list();
    expect(asAdmin?.some((row) => row.id === recorded.overrideId)).toBe(true);

    const asManager = await seam.actors
      .asTenant(tenantA, { userId: managerA, role: "manager" })
      .client.override.list();
    expect(asManager?.some((row) => row.id === recorded.overrideId)).toBe(true);

    const asOtherManager = await seam.actors
      .asTenant(tenantA, { userId: managerAOtherStore, role: "manager" })
      .client.override.list();
    expect(asOtherManager?.some((row) => row.id === recorded.overrideId)).toBe(false);

    const asCashier = await seam.actors
      .asTenant(tenantA, { userId: cashierA, role: "cashier" })
      .client.override.list();
    expect(asCashier).toBeNull();
  });

  it("wrong-tenant probe: Tenant B never sees Tenant A's Override, seeded through A's own scoped connection", async () => {
    const device = await enrolDeviceAt(storeA1, "XA7", adminA, tenantA);
    const recorded = await seam.actors
      .asDevice({
        tenantId: tenantA,
        deviceId: device.deviceId,
        storeId: storeA1,
        code: "XA7",
        name: "t",
      })
      .client.terminal.recordOverride({
        approverUserId: managerA,
        actionType: "drawer_variance",
        reason: "Cash count corrected",
        approvedAt: new Date(),
      });
    if (!recorded.ok) throw new Error("setup failed");

    // The positive side, through A's own app-role connection — proves the
    // row is genuinely readable, not merely absent from an empty table.
    const asA = await withTenantScope(seam.db, tenantA, (db) =>
      db.selectFrom("Override").select("id").where("id", "=", recorded.overrideId).execute(),
    );
    expect(asA).toHaveLength(1);

    const asBTenant = await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.override.list();
    expect(asBTenant?.some((row) => row.id === recorded.overrideId)).toBe(false);

    const asB = await withTenantScope(seam.db, tenantB, (db) =>
      db.selectFrom("Override").select("id").where("id", "=", recorded.overrideId).execute(),
    );
    expect(asB).toHaveLength(0);
  });
});
