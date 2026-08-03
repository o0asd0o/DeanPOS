import { randomUUID } from "node:crypto";

import { hashPassword } from "backend/src/common/password.ts";
import { createDb } from "backend/src/db/client.ts";
import { verifyPin } from "contract/src/pin.ts";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { seedTenantUser } from "../src/seed-tenant-user.ts";
import { createTestSeam } from "../src/test-seam.ts";

// Issue 10: a User sets their own PIN on first use, changes it later, and
// an admin resets it.
const seam = createTestSeam();
const ownerDb = createDb({ databaseUrl: process.env.DATABASE_URI! });

const tenantA = randomUUID();
const cashierA = randomUUID();
const adminA = randomUUID();
const managerA = randomUUID();

beforeAll(async () => {
  await ownerDb.insertInto("Tenant").values({ id: tenantA, name: "PIN Mgmt Tenant" }).execute();
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
});

afterAll(async () => {
  await ownerDb.deleteFrom("UserRole").where("tenant_id", "=", tenantA).execute();
  await ownerDb.deleteFrom("User").where("tenant_id", "=", tenantA).execute();
  await ownerDb.deleteFrom("Tenant").where("id", "=", tenantA).execute();
  await ownerDb.destroy();
  await seam.db.destroy();
});

describe("user.setPin", () => {
  it("sets a PIN on first use with no currentPin required", async () => {
    const client = seam.actors.asTenant(tenantA, { userId: cashierA, role: "cashier" }).client;
    const result = await client.user.setPin({ pin: "1234" });
    expect(result.ok).toBe(true);

    const row = await ownerDb
      .selectFrom("User")
      .select("pin_hash")
      .where("id", "=", cashierA)
      .executeTakeFirstOrThrow();
    expect(row.pin_hash).not.toBeNull();
    expect(await verifyPin("1234", row.pin_hash!)).toBe(true);
  });

  it("changing an existing PIN requires the correct currentPin", async () => {
    const client = seam.actors.asTenant(tenantA, { userId: cashierA, role: "cashier" }).client;

    const wrongCurrent = await client.user.setPin({ pin: "5678", currentPin: "0000" });
    expect(wrongCurrent.ok).toBe(false);

    const ok = await client.user.setPin({ pin: "5678", currentPin: "1234" });
    expect(ok.ok).toBe(true);

    const row = await ownerDb
      .selectFrom("User")
      .select("pin_hash")
      .where("id", "=", cashierA)
      .executeTakeFirstOrThrow();
    expect(await verifyPin("5678", row.pin_hash!)).toBe(true);
    expect(await verifyPin("1234", row.pin_hash!)).toBe(false);
  });

  it("refuses without a tenant session", async () => {
    const result = await seam.client.user.setPin({ pin: "9999" });
    expect(result.ok).toBe(false);
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
});
