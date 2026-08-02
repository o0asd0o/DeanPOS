import { randomUUID } from "node:crypto";

import { createDb, withTenantScope } from "backend/src/db/client.ts";
import { hashPassword } from "backend/src/common/password.ts";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { createTestSeam } from "../src/test-seam.ts";

// `store.get` is the one tenant-scoped procedure issue 04 has to gate for
// real — the other exposed procedures are unauthenticated, platform-admin-
// only, or self-scoped to the caller's own session rather than a Store.
const seam = createTestSeam();
const ownerDb = createDb({ databaseUrl: process.env.DATABASE_URI! });

const tenantId = randomUUID();
const storeAssigned = randomUUID();
const storeUnassigned = randomUUID();

const adminId = randomUUID();
const cashierId = randomUUID();
const managerId = randomUUID();

beforeAll(async () => {
  await ownerDb.insertInto("Tenant").values({ id: tenantId, name: "Gate Tenant" }).execute();

  await withTenantScope(seam.db, tenantId, (db) =>
    db
      .insertInto("Store")
      .values([
        { id: storeAssigned, tenant_id: tenantId, name: "Assigned" },
        { id: storeUnassigned, tenant_id: tenantId, name: "Unassigned" },
      ])
      .execute(),
  );

  const passwordHash = await hashPassword("irrelevant");
  await ownerDb
    .insertInto("User")
    .values([
      {
        id: adminId,
        tenant_id: tenantId,
        email: `gate-admin-${randomUUID()}@authorisation.test`,
        password_hash: passwordHash,
        role: "admin",
      },
      {
        id: cashierId,
        tenant_id: tenantId,
        email: `gate-cashier-${randomUUID()}@authorisation.test`,
        password_hash: passwordHash,
        role: "cashier",
      },
      {
        id: managerId,
        tenant_id: tenantId,
        email: `gate-manager-${randomUUID()}@authorisation.test`,
        password_hash: passwordHash,
        role: "manager",
      },
    ])
    .execute();

  // The manager is assigned to exactly one of the two Stores; admin and
  // cashier get no UserStore row at all — the admin-exemption case this
  // issue names as the most likely defect.
  await withTenantScope(seam.db, tenantId, (db) =>
    db
      .insertInto("UserStore")
      .values({
        id: randomUUID(),
        tenant_id: tenantId,
        user_id: managerId,
        store_id: storeAssigned,
        assigned: true,
        effective_from: new Date(Date.now() - 60_000),
      })
      .execute(),
  );
});

afterAll(async () => {
  await ownerDb.deleteFrom("UserStore").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("User").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Store").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Tenant").where("id", "=", tenantId).execute();
  await ownerDb.destroy();
  await seam.db.destroy();
});

describe("store.get: role gating", () => {
  it("a cashier with no UserStore row reaches nothing, even a Store in their own Tenant", async () => {
    const result = await seam.actors
      .asTenant(tenantId, { userId: cashierId, role: "cashier" })
      .client.store.get({ id: storeAssigned });

    expect(result).toBeNull();
  });

  it("the cashier's refusal is identical whether the Store exists or not — no disclosure", async () => {
    const existing = await seam.actors
      .asTenant(tenantId, { userId: cashierId, role: "cashier" })
      .client.store.get({ id: storeAssigned });
    const missing = await seam.actors
      .asTenant(tenantId, { userId: cashierId, role: "cashier" })
      .client.store.get({ id: randomUUID() });

    expect(existing).toBeNull();
    expect(missing).toBeNull();
  });
});

describe("store.get: the admin exemption", () => {
  it("an admin with no UserStore row reaches every Store in their Tenant", async () => {
    const assigned = await seam.actors
      .asTenant(tenantId, { userId: adminId, role: "admin" })
      .client.store.get({ id: storeAssigned });
    const unassigned = await seam.actors
      .asTenant(tenantId, { userId: adminId, role: "admin" })
      .client.store.get({ id: storeUnassigned });

    expect(assigned?.id).toBe(storeAssigned);
    expect(unassigned?.id).toBe(storeUnassigned);
  });
});

describe("store.get: a manager is scoped to their assigned Stores", () => {
  it("reaches a Store they are assigned to", async () => {
    const result = await seam.actors
      .asTenant(tenantId, { userId: managerId, role: "manager" })
      .client.store.get({ id: storeAssigned });

    expect(result?.id).toBe(storeAssigned);
  });

  it("is refused a Store in the same Tenant they are not assigned to — the row exists and is hidden, not absent", async () => {
    const asAdmin = await seam.actors
      .asTenant(tenantId, { userId: adminId, role: "admin" })
      .client.store.get({ id: storeUnassigned });
    expect(asAdmin?.id).toBe(storeUnassigned);

    const asManager = await seam.actors
      .asTenant(tenantId, { userId: managerId, role: "manager" })
      .client.store.get({ id: storeUnassigned });
    expect(asManager).toBeNull();
  });
});
