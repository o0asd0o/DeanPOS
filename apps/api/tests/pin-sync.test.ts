import { randomUUID } from "node:crypto";

import { hashPassword } from "backend/src/common/password.ts";
import { createDb, withTenantScope } from "backend/src/db/client.ts";
import { hashPin } from "contract/src/pin.ts";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { seedTenantUser } from "../src/seed-tenant-user.ts";
import { createTestSeam } from "../src/test-seam.ts";
import { expectWrongTenantRefusal } from "../src/wrong-tenant-probe.ts";

// Issue 10: terminal.pinSync, the hash-sync payload. The payload assertions
// are on the payload itself (record 057 Q3), not on device behaviour.
// Refusal is `null`, the same not-found shape store.get uses.
const seam = createTestSeam();
const ownerDb = createDb({ databaseUrl: process.env.DATABASE_URI! });

const tenantA = randomUUID();
const tenantB = randomUUID();
const adminA = randomUUID();
const managerA = randomUUID(); // assigned to storeA1
const cashierA = randomUUID(); // assigned to storeA1
const cashierElsewhere = randomUUID(); // assigned to storeA2 only
const deactivatedA = randomUUID(); // assigned to storeA1, but inactive
const adminB = randomUUID();
const cashierB = randomUUID(); // assigned to storeB, has a PIN hash
const storeA1 = randomUUID();
const storeA2 = randomUUID();
const storeB = randomUUID();

async function assignStore(tenantId: string, userId: string, storeId: string) {
  await withTenantScope(seam.db, tenantId, (db) =>
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
    .client.device.generateCode({ storeId, name: "PIN Sync Terminal", code });
  if (!generated.ok) throw new Error("setup: generateCode failed");
  const exchanged = await seam.client.terminal.enrol({ secret: generated.secret });
  if (!exchanged.ok) throw new Error("setup: enrol failed");
  return exchanged;
}

beforeAll(async () => {
  await ownerDb
    .insertInto("Tenant")
    .values([
      { id: tenantA, name: "PIN Sync Tenant A" },
      { id: tenantB, name: "PIN Sync Tenant B" },
    ])
    .execute();

  const passwordHash = await hashPassword("irrelevant");
  const pinHashCashier = await hashPin("135790");
  const pinHashManager = await hashPin("246813");
  const pinHashCashierB = await hashPin("864209");

  await seedTenantUser(ownerDb, {
    id: adminA,
    tenantId: tenantA,
    email: `pin-admin-${randomUUID()}@pin.test`,
    passwordHash,
    role: "admin",
  });
  await seedTenantUser(ownerDb, {
    id: managerA,
    tenantId: tenantA,
    email: `pin-manager-${randomUUID()}@pin.test`,
    passwordHash,
    role: "manager",
  });
  await seedTenantUser(ownerDb, {
    id: cashierA,
    tenantId: tenantA,
    email: `pin-cashier-${randomUUID()}@pin.test`,
    passwordHash,
    role: "cashier",
  });
  await seedTenantUser(ownerDb, {
    id: cashierElsewhere,
    tenantId: tenantA,
    email: `pin-cashier-elsewhere-${randomUUID()}@pin.test`,
    passwordHash,
    role: "cashier",
  });
  await seedTenantUser(ownerDb, {
    id: deactivatedA,
    tenantId: tenantA,
    email: `pin-deactivated-${randomUUID()}@pin.test`,
    passwordHash,
    role: "cashier",
    active: false,
  });
  await seedTenantUser(ownerDb, {
    id: adminB,
    tenantId: tenantB,
    email: `pin-admin-b-${randomUUID()}@pin.test`,
    passwordHash,
    role: "admin",
  });
  await seedTenantUser(ownerDb, {
    id: cashierB,
    tenantId: tenantB,
    email: `pin-cashier-b-${randomUUID()}@pin.test`,
    passwordHash,
    role: "cashier",
  });

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

  await assignStore(tenantA, managerA, storeA1);
  await assignStore(tenantA, cashierA, storeA1);
  await assignStore(tenantA, cashierElsewhere, storeA2);
  await assignStore(tenantA, deactivatedA, storeA1);
  await assignStore(tenantB, cashierB, storeB);

  await ownerDb
    .updateTable("User")
    .set({ pin_hash: pinHashCashier })
    .where("id", "=", cashierA)
    .execute();
  await ownerDb
    .updateTable("User")
    .set({ pin_hash: pinHashManager })
    .where("id", "=", managerA)
    .execute();
  await ownerDb
    .updateTable("User")
    .set({ pin_hash: pinHashCashierB, first_name: "Beatriz", last_name: "Santos" })
    .where("id", "=", cashierB)
    .execute();
  // adminA and cashierElsewhere have no PIN set yet — pinHash must be null.
});

afterAll(async () => {
  // EnrolmentCode.device_id FKs Device with ON DELETE RESTRICT — clear the
  // referencing rows first (mirrors device.test.ts).
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

describe("terminal.pinSync", () => {
  it("returns exactly the root keys storeId, syncedAt, users, assignedUserId, assignedUserStatus — no ok field", async () => {
    const device = await enrolDeviceAt(storeA1, "PS0", adminA, tenantA);
    const result = await seam.actors.withBearerToken(device.token).terminal.pinSync();

    expect(result).not.toBeNull();
    expect(Object.keys(result!).sort()).toStrictEqual(
      ["storeId", "syncedAt", "users", "assignedUserId", "assignedUserStatus"].sort(),
    );
    // An open-to-all Device (issue 17's default, no data migration needed).
    expect(result!.assignedUserId).toBeNull();
    expect(result!.assignedUserStatus).toBeNull();
  });

  it("contains exactly that Store's active Users: admin plus assigned cashiers/managers, no other Store, no deactivated User", async () => {
    const device = await enrolDeviceAt(storeA1, "PS1", adminA, tenantA);
    const result = await seam.actors.withBearerToken(device.token).terminal.pinSync();

    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.storeId).toBe(storeA1);

    const userIds = result.users.map((u) => u.userId).sort();
    expect(userIds).toStrictEqual([adminA, cashierA, managerA].sort());
    expect(userIds).not.toContain(cashierElsewhere);
    expect(userIds).not.toContain(deactivatedA);
  });

  it("carries a hash for a User who has set one, null for one who has not, and never a password hash or email", async () => {
    const device = await enrolDeviceAt(storeA1, "PS2", adminA, tenantA);
    const result = await seam.actors.withBearerToken(device.token).terminal.pinSync();

    expect(result).not.toBeNull();
    if (!result) return;

    const cashierRow = result.users.find((u) => u.userId === cashierA);
    const adminRow = result.users.find((u) => u.userId === adminA);
    expect(cashierRow?.pinHash).toMatch(/^\$pbkdf2-sha256\$/);
    expect(adminRow?.pinHash).toBeNull();

    for (const user of result.users) {
      expect(user).not.toHaveProperty("email");
      expect(user).not.toHaveProperty("role");
      expect(user).not.toHaveProperty("passwordHash");
      expect(Object.keys(user).sort()).toStrictEqual(
        ["displayName", "pinHash", "userId", "canApproveOverride"].sort(),
      );
    }
  });

  it("a User with no name on record is labelled, never blank — a blank button cannot be picked", async () => {
    // adminA is seeded the way provisionTenant creates a tenant owner: no
    // first or last name, so both columns hold the migration's ''.
    const device = await enrolDeviceAt(storeA1, "PS2b", adminA, tenantA);
    const result = await seam.actors.withBearerToken(device.token).terminal.pinSync();

    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.users.find((u) => u.userId === adminA)?.displayName).toBe("Unknown");
  });

  it("an admin's PIN hash lands on every terminal in the tenant, including a Store the admin is not assigned to", async () => {
    const device = await enrolDeviceAt(storeA2, "PS3", adminA, tenantA);
    const result = await seam.actors.withBearerToken(device.token).terminal.pinSync();

    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.users.map((u) => u.userId)).toContain(adminA);
  });

  it("deactivating a User removes their hash from the next payload; reactivating restores it", async () => {
    const toggledId = randomUUID();
    const passwordHash = await hashPassword("irrelevant");
    const pinHash = await hashPin("998877");
    await seedTenantUser(ownerDb, {
      id: toggledId,
      tenantId: tenantA,
      email: `pin-toggle-${randomUUID()}@pin.test`,
      passwordHash,
      role: "cashier",
    });
    await assignStore(tenantA, toggledId, storeA1);
    await ownerDb
      .updateTable("User")
      .set({ pin_hash: pinHash })
      .where("id", "=", toggledId)
      .execute();

    const device = await enrolDeviceAt(storeA1, "PS4", adminA, tenantA);
    const client = seam.actors.withBearerToken(device.token);

    const before = await client.terminal.pinSync();
    expect(before?.users.some((u) => u.userId === toggledId)).toBe(true);

    await ownerDb.updateTable("User").set({ active: false }).where("id", "=", toggledId).execute();
    const whileInactive = await client.terminal.pinSync();
    expect(whileInactive?.users.some((u) => u.userId === toggledId)).toBe(false);

    await ownerDb.updateTable("User").set({ active: true }).where("id", "=", toggledId).execute();
    const afterReactivate = await client.terminal.pinSync();
    expect(afterReactivate?.users.some((u) => u.userId === toggledId)).toBe(true);

    await ownerDb.deleteFrom("UserStore").where("user_id", "=", toggledId).execute();
    await ownerDb.deleteFrom("UserRole").where("user_id", "=", toggledId).execute();
    await ownerDb.deleteFrom("User").where("id", "=", toggledId).execute();
  });

  it("refuses with no Device token, an unrecognised token, and a revoked Device's token", async () => {
    const noToken = await seam.actors.withBearerToken(null).terminal.pinSync();
    expect(noToken).toBeNull();

    const badToken = await seam.actors.withBearerToken("not-a-real-token").terminal.pinSync();
    expect(badToken).toBeNull();

    const device = await enrolDeviceAt(storeA1, "PS5", adminA, tenantA);
    await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.device.revoke({ id: device.deviceId });
    const revoked = await seam.actors.withBearerToken(device.token).terminal.pinSync();
    expect(revoked).toBeNull();
  });

  it("a User's own tenant session (not a Device token) is refused — a PIN is never accepted without a valid, unrevoked Device token", async () => {
    const asSession = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.terminal.pinSync();
    expect(asSession).toBeNull();
  });

  it("wrong-tenant probe [terminal.pinSync]: Tenant B's own Device receives its cashier's row; Tenant A's Device receives none of it", async () => {
    const deviceB = await enrolDeviceAt(storeB, "PSB1", adminB, tenantB);
    const resultB = await seam.actors.withBearerToken(deviceB.token).terminal.pinSync();

    expect(resultB).not.toBeNull();
    if (!resultB) return;
    expect(resultB.storeId).toBe(storeB);
    const cashierBRow = resultB.users.find((u) => u.userId === cashierB);
    expect(cashierBRow?.displayName).toBeTruthy();
    expect(cashierBRow?.pinHash).toMatch(/^\$pbkdf2-sha256\$/);

    const deviceA = await enrolDeviceAt(storeA1, "PSA1", adminA, tenantA);
    const resultA = await seam.actors.withBearerToken(deviceA.token).terminal.pinSync();

    expect(resultA).not.toBeNull();
    if (!resultA) return;
    expect(resultA.storeId).not.toBe(storeB);
    expect(resultA.users.map((u) => u.userId)).not.toContain(cashierB);
    expect(resultA.users.map((u) => u.userId)).not.toContain(adminB);
    expect(resultA.users.map((u) => u.pinHash)).not.toContain(cashierBRow!.pinHash);
    expect(resultA.users.map((u) => u.displayName)).not.toContain(cashierBRow!.displayName);

    await expectWrongTenantRefusal({
      path: "terminal.pinSync",
      mode: "confined",
      ownerSees: resultB,
      otherGets: async () => resultA,
      otherOwn: resultA,
    });
  });
});

// Issue 17: the single-employee terminal. The restriction lives entirely in
// this payload — `assignedUserId` non-null narrows `users` server-side.
describe("terminal.pinSync — a restricted Device", () => {
  it("carries only the assigned User and this Store's manager-or-above, and no one else", async () => {
    // A second cashier at the same Store, seeded only for this test — the
    // one fixture that proves the filter actually removes somebody.
    const cashierA2 = randomUUID();
    const passwordHash = await hashPassword("irrelevant");
    const pinHashCashierA2 = await hashPin("112233");
    await seedTenantUser(ownerDb, {
      id: cashierA2,
      tenantId: tenantA,
      email: `pin-cashier-a2-${randomUUID()}@pin.test`,
      passwordHash,
      role: "cashier",
    });
    await assignStore(tenantA, cashierA2, storeA1);
    await ownerDb
      .updateTable("User")
      .set({ pin_hash: pinHashCashierA2, first_name: "Second", last_name: "Cashier" })
      .where("id", "=", cashierA2)
      .execute();

    try {
      const device = await enrolDeviceAt(storeA1, "PS6", adminA, tenantA);
      const asAdmin = seam.actors.asTenant(tenantA, { userId: adminA, role: "admin" });
      const assigned = await asAdmin.client.device.setAssignedUser({
        id: device.deviceId,
        userId: cashierA,
      });
      expect(assigned?.assignedUserId).toBe(cashierA);

      const result = await seam.actors.withBearerToken(device.token).terminal.pinSync();
      expect(result).not.toBeNull();
      if (!result) return;
      expect(result.assignedUserId).toBe(cashierA);
      expect(result.assignedUserStatus).toBeNull();

      const userIds = result.users.map((u) => u.userId).sort();
      // adminA and managerA both qualify as canApproveOverride at this Store;
      // cashierA is the assigned User. cashierElsewhere and deactivatedA were
      // already excluded from the open roster and stay excluded here.
      expect(userIds).toStrictEqual([adminA, managerA, cashierA].sort());
      expect(userIds).not.toContain(cashierA2);
      expect(result.users.map((u) => u.displayName)).not.toContain("Second Cashier");
      expect(result.users.map((u) => u.pinHash)).not.toContain(pinHashCashierA2);
      for (const user of result.users) {
        if (user.userId === cashierA) continue;
        expect(user.canApproveOverride).toBe(true);
      }
    } finally {
      // A failure here otherwise leaves an extra active cashier at storeA1 and
      // cascades into the open-roster test below, hiding which one really broke.
      await ownerDb.deleteFrom("UserStore").where("user_id", "=", cashierA2).execute();
      await ownerDb.deleteFrom("UserRole").where("user_id", "=", cashierA2).execute();
      await ownerDb.deleteFrom("User").where("id", "=", cashierA2).execute();
    }
  });

  it("clearing the restriction restores the full open-to-all roster on the next sync", async () => {
    const device = await enrolDeviceAt(storeA1, "PS7", adminA, tenantA);
    const asAdmin = seam.actors.asTenant(tenantA, { userId: adminA, role: "admin" });
    await asAdmin.client.device.setAssignedUser({ id: device.deviceId, userId: cashierA });

    const cleared = await asAdmin.client.device.setAssignedUser({
      id: device.deviceId,
      userId: null,
    });
    expect(cleared?.assignedUserId).toBeNull();

    const result = await seam.actors.withBearerToken(device.token).terminal.pinSync();
    expect(result?.assignedUserId).toBeNull();
    expect(result?.users.map((u) => u.userId).sort()).toStrictEqual(
      [adminA, cashierA, managerA].sort(),
    );
  });

  it("reports 'unassigned' when the assigned User was unassigned from the Store since the last sync", async () => {
    const device = await enrolDeviceAt(storeA1, "PS8", adminA, tenantA);
    await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.device.setAssignedUser({ id: device.deviceId, userId: cashierA });

    // Un-assign cashierA from storeA1 with a closing row (issue 04's shape).
    await ownerDb
      .insertInto("UserStore")
      .values({
        id: randomUUID(),
        tenant_id: tenantA,
        user_id: cashierA,
        store_id: storeA1,
        assigned: false,
        effective_from: new Date(),
      })
      .execute();

    const result = await seam.actors.withBearerToken(device.token).terminal.pinSync();
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.assignedUserId).toBe(cashierA);
    expect(result.assignedUserStatus).toBe("unassigned");
    expect(result.users.map((u) => u.userId)).not.toContain(cashierA);

    // Restore cashierA's assignment for any later test in this file.
    await ownerDb
      .insertInto("UserStore")
      .values({
        id: randomUUID(),
        tenant_id: tenantA,
        user_id: cashierA,
        store_id: storeA1,
        assigned: true,
        effective_from: new Date(),
      })
      .execute();
    await asAdminClearAssignment(device.deviceId);
  });

  it("reports 'deactivated' when the assigned User was deactivated since the last sync", async () => {
    const deactivatedTarget = randomUUID();
    const passwordHash = await hashPassword("irrelevant");
    await seedTenantUser(ownerDb, {
      id: deactivatedTarget,
      tenantId: tenantA,
      email: `pin-restrict-deactivate-${randomUUID()}@pin.test`,
      passwordHash,
      role: "cashier",
    });
    await assignStore(tenantA, deactivatedTarget, storeA1);

    const device = await enrolDeviceAt(storeA1, "PS9", adminA, tenantA);
    await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.device.setAssignedUser({ id: device.deviceId, userId: deactivatedTarget });

    await ownerDb
      .updateTable("User")
      .set({ active: false })
      .where("id", "=", deactivatedTarget)
      .execute();

    const result = await seam.actors.withBearerToken(device.token).terminal.pinSync();
    expect(result?.assignedUserId).toBe(deactivatedTarget);
    expect(result?.assignedUserStatus).toBe("deactivated");
    expect(result?.users.map((u) => u.userId)).not.toContain(deactivatedTarget);

    await ownerDb.deleteFrom("UserStore").where("user_id", "=", deactivatedTarget).execute();
    await ownerDb.deleteFrom("UserRole").where("user_id", "=", deactivatedTarget).execute();
    await asAdminClearAssignment(device.deviceId);
    await ownerDb.deleteFrom("User").where("id", "=", deactivatedTarget).execute();
  });
});

async function asAdminClearAssignment(deviceId: string) {
  await seam.actors
    .asTenant(tenantA, { userId: adminA, role: "admin" })
    .client.device.setAssignedUser({ id: deviceId, userId: null });
}
