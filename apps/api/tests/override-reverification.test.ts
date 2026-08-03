import { randomUUID } from "node:crypto";

import { hashPassword } from "backend/src/common/password.ts";
import { createDb, withTenantScope } from "backend/src/db/client.ts";
import { OVERRIDE_CLOCK_SKEW_MS, verifyOverrideAsOf } from "backend/src/override/helpers.ts";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { seedTenantUser } from "../src/seed-tenant-user.ts";

// Issue 12, record 060 Q4: `verifyOverrideAsOf`, tested directly against
// seeded UserRole/UserStore history — no seam, no contract procedure.
const ownerDb = createDb({ databaseUrl: process.env.DATABASE_URI! });

const tenantId = randomUUID();
const storeId = randomUUID();
const otherStoreId = randomUUID();
const managerId = randomUUID();
const adminId = randomUUID();
const cashierId = randomUUID();
const HOUR = 60 * 60 * 1000;

beforeAll(async () => {
  await ownerDb.insertInto("Tenant").values({ id: tenantId, name: "Reverify Tenant" }).execute();
  const passwordHash = await hashPassword("irrelevant");
  await seedTenantUser(ownerDb, {
    id: managerId,
    tenantId,
    email: `reverify-manager-${randomUUID()}@reverify.test`,
    passwordHash,
    role: "manager",
  });
  await seedTenantUser(ownerDb, {
    id: adminId,
    tenantId,
    email: `reverify-admin-${randomUUID()}@reverify.test`,
    passwordHash,
    role: "admin",
  });
  await seedTenantUser(ownerDb, {
    id: cashierId,
    tenantId,
    email: `reverify-cashier-${randomUUID()}@reverify.test`,
    passwordHash,
    role: "cashier",
  });
  await withTenantScope(ownerDb, tenantId, (db) =>
    db
      .insertInto("Store")
      .values([
        { id: storeId, tenant_id: tenantId, name: "Reverify Store" },
        { id: otherStoreId, tenant_id: tenantId, name: "Reverify Other Store" },
      ])
      .execute(),
  );
});

afterAll(async () => {
  await ownerDb.deleteFrom("UserStore").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("UserRole").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Store").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("User").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Tenant").where("id", "=", tenantId).execute();
  await ownerDb.destroy();
});

async function assignStore(userId: string, effectiveFrom: Date, assigned = true) {
  await withTenantScope(ownerDb, tenantId, (db) =>
    db
      .insertInto("UserStore")
      .values({
        id: randomUUID(),
        tenant_id: tenantId,
        user_id: userId,
        store_id: storeId,
        assigned,
        effective_from: effectiveFrom,
      })
      .execute(),
  );
}

// A plain User row with no implicit "now" UserRole — seedTenantUser always
// appends one at its own call time, which would outrank a deliberately
// backdated row below it. These tests need full control over every row's
// effective_from.
async function insertUserWithNoRole(userId: string) {
  await ownerDb
    .insertInto("User")
    .values({
      id: userId,
      tenant_id: tenantId,
      email: `reverify-${randomUUID()}@reverify.test`,
      password_hash: await hashPassword("irrelevant"),
      role: "manager",
    })
    .execute();
}

async function seedManagerBefore(userId: string) {
  await insertUserWithNoRole(userId);
  await changeRole(userId, "manager", new Date(Date.now() - 3 * HOUR));
}

async function changeRole(
  userId: string,
  role: "cashier" | "manager" | "admin",
  effectiveFrom: Date,
) {
  await withTenantScope(ownerDb, tenantId, (db) =>
    db
      .insertInto("UserRole")
      .values({
        id: randomUUID(),
        tenant_id: tenantId,
        user_id: userId,
        role,
        effective_from: effectiveFrom,
      })
      .execute(),
  );
}

describe("verifyOverrideAsOf", () => {
  it("a manager assigned to the Store verifies", async () => {
    const userId = randomUUID();
    await seedTenantUser(ownerDb, {
      id: userId,
      tenantId,
      email: `reverify-${randomUUID()}@reverify.test`,
      passwordHash: await hashPassword("irrelevant"),
      role: "manager",
    });
    await assignStore(userId, new Date(Date.now() - HOUR));

    const result = await withTenantScope(ownerDb, tenantId, (db) =>
      verifyOverrideAsOf(db, { tenantId, userId, storeId, asOf: new Date() }),
    );
    expect(result.ok).toBe(true);
  });

  it("an admin verifies without a Store assignment", async () => {
    const result = await withTenantScope(ownerDb, tenantId, (db) =>
      verifyOverrideAsOf(db, { tenantId, userId: adminId, storeId, asOf: new Date() }),
    );
    expect(result.ok).toBe(true);
  });

  it("a cashier is refused, role too low", async () => {
    await assignStore(cashierId, new Date(Date.now() - HOUR));
    const result = await withTenantScope(ownerDb, tenantId, (db) =>
      verifyOverrideAsOf(db, { tenantId, userId: cashierId, storeId, asOf: new Date() }),
    );
    expect(result).toEqual({ ok: false, reason: "role-too-low" });
  });

  it("an unknown User is refused", async () => {
    const result = await withTenantScope(ownerDb, tenantId, (db) =>
      verifyOverrideAsOf(db, { tenantId, userId: randomUUID(), storeId, asOf: new Date() }),
    );
    expect(result).toEqual({ ok: false, reason: "unknown-user" });
  });

  it("a stated time before any role history is refused, fail closed", async () => {
    const userId = randomUUID();
    await seedTenantUser(ownerDb, {
      id: userId,
      tenantId,
      email: `reverify-${randomUUID()}@reverify.test`,
      passwordHash: await hashPassword("irrelevant"),
      role: "manager",
    });
    const result = await withTenantScope(ownerDb, tenantId, (db) =>
      verifyOverrideAsOf(db, {
        tenantId,
        userId,
        storeId,
        asOf: new Date(Date.now() - 10 * HOUR),
      }),
    );
    expect(result).toEqual({ ok: false, reason: "no-role-history" });
  });

  it("a claim beyond the clock-skew ceiling is out of bounds", async () => {
    const result = await withTenantScope(ownerDb, tenantId, (db) =>
      verifyOverrideAsOf(db, {
        tenantId,
        userId: managerId,
        storeId,
        asOf: new Date(Date.now() + OVERRIDE_CLOCK_SKEW_MS + 60_000),
      }),
    );
    expect(result).toEqual({ ok: false, reason: "time-out-of-bounds" });
  });

  // Criterion 7, all four cases: a role/membership change after the stated
  // time must never retroactively change a past approval's verdict.
  describe("criterion 7 — effective-dated history, not today's values", () => {
    it("a manager demoted after the Override still verifies", async () => {
      const userId = randomUUID();
      await seedManagerBefore(userId);
      await assignStore(userId, new Date(Date.now() - 2 * HOUR));
      const approvedAt = new Date(Date.now() - HOUR);
      await changeRole(userId, "cashier", new Date()); // demoted now, after approvedAt

      const result = await withTenantScope(ownerDb, tenantId, (db) =>
        verifyOverrideAsOf(db, { tenantId, userId, storeId, asOf: approvedAt }),
      );
      expect(result.ok).toBe(true);
    });

    it("a manager demoted before the Override does not verify", async () => {
      const userId = randomUUID();
      await seedManagerBefore(userId);
      await assignStore(userId, new Date(Date.now() - 2 * HOUR));
      await changeRole(userId, "cashier", new Date(Date.now() - 90 * 60 * 1000)); // demoted before

      const result = await withTenantScope(ownerDb, tenantId, (db) =>
        verifyOverrideAsOf(db, { tenantId, userId, storeId, asOf: new Date() }),
      );
      expect(result).toEqual({ ok: false, reason: "role-too-low" });
    });

    it("a manager unassigned from the Store after the Override still verifies", async () => {
      const userId = randomUUID();
      await seedManagerBefore(userId);
      await assignStore(userId, new Date(Date.now() - 2 * HOUR));
      const approvedAt = new Date(Date.now() - HOUR);
      await assignStore(userId, new Date(), false); // unassigned now, after approvedAt

      const result = await withTenantScope(ownerDb, tenantId, (db) =>
        verifyOverrideAsOf(db, { tenantId, userId, storeId, asOf: approvedAt }),
      );
      expect(result.ok).toBe(true);
    });

    it("a manager unassigned from the Store before the Override does not verify", async () => {
      const userId = randomUUID();
      await seedManagerBefore(userId);
      await assignStore(userId, new Date(Date.now() - 2 * HOUR));
      await assignStore(userId, new Date(Date.now() - 90 * 60 * 1000), false); // unassigned before

      const result = await withTenantScope(ownerDb, tenantId, (db) =>
        verifyOverrideAsOf(db, { tenantId, userId, storeId, asOf: new Date() }),
      );
      expect(result).toEqual({ ok: false, reason: "not-assigned-to-store" });
    });
  });

  it("a manager assigned to a different Store is refused", async () => {
    const userId = randomUUID();
    await seedManagerBefore(userId);
    await withTenantScope(ownerDb, tenantId, (db) =>
      db
        .insertInto("UserStore")
        .values({
          id: randomUUID(),
          tenant_id: tenantId,
          user_id: userId,
          store_id: otherStoreId,
          assigned: true,
          effective_from: new Date(Date.now() - HOUR),
        })
        .execute(),
    );

    const result = await withTenantScope(ownerDb, tenantId, (db) =>
      verifyOverrideAsOf(db, { tenantId, userId, storeId, asOf: new Date() }),
    );
    expect(result).toEqual({ ok: false, reason: "not-assigned-to-store" });
  });
});
