import { randomUUID } from "node:crypto";

import { hashPassword } from "backend/src/common/password.ts";
import { createDb } from "backend/src/db/client.ts";
import { hashPin, verifyPin } from "contract/src/pin.ts";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { seedTenantUser } from "../src/seed-tenant-user.ts";
import { createTestSeam } from "../src/test-seam.ts";

// Issue 10, record 058: a User sets their own PIN on first use, changes it
// later — one shape, no `currentPin`, no procedure ever verifies a
// submitted PIN — and an admin resets it.
const seam = createTestSeam();
const ownerDb = createDb({ databaseUrl: process.env.DATABASE_URI! });

const tenantA = randomUUID();
const cashierA = randomUUID();
const adminA = randomUUID();
const managerA = randomUUID();
const tenantB = randomUUID();
const cashierB = randomUUID();

beforeAll(async () => {
  await ownerDb
    .insertInto("Tenant")
    .values([
      { id: tenantA, name: "PIN Mgmt Tenant A" },
      { id: tenantB, name: "PIN Mgmt Tenant B" },
    ])
    .execute();
  const passwordHash = await hashPassword("irrelevant");
  await seedTenantUser(ownerDb, {
    id: cashierA,
    tenantId: tenantA,
    email: `pin-mgmt-cashier-${randomUUID()}@pin.test`,
    passwordHash,
    role: "cashier",
  });
  await seedTenantUser(ownerDb, {
    id: adminA,
    tenantId: tenantA,
    email: `pin-mgmt-admin-${randomUUID()}@pin.test`,
    passwordHash,
    role: "admin",
  });
  await seedTenantUser(ownerDb, {
    id: managerA,
    tenantId: tenantA,
    email: `pin-mgmt-manager-${randomUUID()}@pin.test`,
    passwordHash,
    role: "manager",
  });
  await seedTenantUser(ownerDb, {
    id: cashierB,
    tenantId: tenantB,
    email: `pin-mgmt-cashier-b-${randomUUID()}@pin.test`,
    passwordHash,
    role: "cashier",
  });
  await ownerDb
    .updateTable("User")
    .set({ pin_hash: await hashPin("246810") })
    .where("id", "=", cashierB)
    .execute();
});

afterAll(async () => {
  await ownerDb.deleteFrom("UserRole").where("tenant_id", "in", [tenantA, tenantB]).execute();
  await ownerDb.deleteFrom("User").where("tenant_id", "in", [tenantA, tenantB]).execute();
  await ownerDb.deleteFrom("Tenant").where("id", "in", [tenantA, tenantB]).execute();
  await ownerDb.destroy();
  await seam.db.destroy();
});

describe("user.setPin", () => {
  it("sets a PIN on first use, and changes it, with no currentPin field", async () => {
    const client = seam.actors.asTenant(tenantA, { userId: cashierA, role: "cashier" }).client;

    const first = await client.user.setPin({ pin: "1234" });
    expect(first.ok).toBe(true);
    const afterFirst = await ownerDb
      .selectFrom("User")
      .select("pin_hash")
      .where("id", "=", cashierA)
      .executeTakeFirstOrThrow();
    expect(await verifyPin("1234", afterFirst.pin_hash!)).toBe(true);

    const changed = await client.user.setPin({ pin: "5678" });
    expect(changed.ok).toBe(true);
    const afterChange = await ownerDb
      .selectFrom("User")
      .select("pin_hash")
      .where("id", "=", cashierA)
      .executeTakeFirstOrThrow();
    expect(await verifyPin("5678", afterChange.pin_hash!)).toBe(true);
    expect(await verifyPin("1234", afterChange.pin_hash!)).toBe(false);
  });

  it("refuses without a tenant session", async () => {
    const result = await seam.client.user.setPin({ pin: "9999" });
    expect(result.ok).toBe(false);
  });

  it("wrong-tenant probe: a Tenant A session cannot write Tenant B's PIN hash", async () => {
    const beforeRow = await ownerDb
      .selectFrom("User")
      .select("pin_hash")
      .where("id", "=", cashierB)
      .executeTakeFirstOrThrow();
    expect(await verifyPin("246810", beforeRow.pin_hash!)).toBe(true);

    const asTenantAWithBsId = seam.actors.asTenant(tenantA, {
      userId: cashierB,
      role: "cashier",
    }).client;
    const result = await asTenantAWithBsId.user.setPin({ pin: "111111" });
    expect(result.ok).toBe(false);

    const afterRow = await ownerDb
      .selectFrom("User")
      .select("pin_hash")
      .where("id", "=", cashierB)
      .executeTakeFirstOrThrow();
    expect(afterRow.pin_hash).toBe(beforeRow.pin_hash);
  });
});

describe("user.resetPin", () => {
  it("an admin clears the hash to NULL, never returning a PIN", async () => {
    const asAdmin = seam.actors.asTenant(tenantA, { userId: adminA, role: "admin" }).client;
    await asAdmin.user.resetPin({ id: cashierA });

    const row = await ownerDb
      .selectFrom("User")
      .select("pin_hash")
      .where("id", "=", cashierA)
      .executeTakeFirstOrThrow();
    expect(row.pin_hash).toBeNull();
  });

  it("a manager and a cashier are refused, server-side", async () => {
    const asManager = seam.actors.asTenant(tenantA, { userId: managerA, role: "manager" }).client;
    const asCashier = seam.actors.asTenant(tenantA, { userId: cashierA, role: "cashier" }).client;

    expect((await asManager.user.resetPin({ id: cashierA })).ok).toBe(false);
    expect((await asCashier.user.resetPin({ id: adminA })).ok).toBe(false);
  });

  it("wrong-tenant probe: a Tenant A admin cannot reset Tenant B's PIN hash", async () => {
    const beforeRow = await ownerDb
      .selectFrom("User")
      .select("pin_hash")
      .where("id", "=", cashierB)
      .executeTakeFirstOrThrow();
    expect(beforeRow.pin_hash).not.toBeNull();

    const asAdminA = seam.actors.asTenant(tenantA, { userId: adminA, role: "admin" }).client;
    const result = await asAdminA.user.resetPin({ id: cashierB });
    expect(result.ok).toBe(false);

    const afterRow = await ownerDb
      .selectFrom("User")
      .select("pin_hash")
      .where("id", "=", cashierB)
      .executeTakeFirstOrThrow();
    expect(afterRow.pin_hash).toBe(beforeRow.pin_hash);
  });
});
