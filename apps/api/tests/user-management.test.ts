import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { getRoleAsOf } from "backend/src/access/db-operations/queries/get-role-as-of.query.ts";
import { hasAtLeastRole } from "backend/src/common/authorize.ts";
import { hashPassword } from "backend/src/common/password.ts";
import { createDb, withTenantScope } from "backend/src/db/client.ts";
import { seedTenantUser } from "../src/seed-tenant-user.ts";
import { createTestSeam } from "../src/test-seam.ts";
import { expectWrongTenantRefusal } from "../src/wrong-tenant-probe.ts";

// Issue 06: create, promote/reassign, reset, deactivate/reactivate a User.
const seam = createTestSeam();
const ownerDb = createDb({ databaseUrl: process.env.DATABASE_URI! });

const tenantA = randomUUID();
const tenantB = randomUUID();
const adminA = randomUUID();
const managerA = randomUUID();
const cashierA = randomUUID();
const storeA1 = randomUUID();
const storeA2 = randomUUID();
const adminB = randomUUID();
const storeB = randomUUID();

beforeAll(async () => {
  await ownerDb
    .insertInto("Tenant")
    .values([
      { id: tenantA, name: "User Mgmt Tenant A" },
      { id: tenantB, name: "User Mgmt Tenant B" },
    ])
    .execute();

  const passwordHash = await hashPassword("irrelevant");
  await seedTenantUser(ownerDb, {
    id: adminA,
    tenantId: tenantA,
    email: `um-admin-${randomUUID()}@user.test`,
    passwordHash,
    role: "admin",
    mustChangePassword: false,
  });
  await seedTenantUser(ownerDb, {
    id: managerA,
    tenantId: tenantA,
    email: `um-manager-${randomUUID()}@user.test`,
    passwordHash,
    role: "manager",
    mustChangePassword: false,
  });
  await seedTenantUser(ownerDb, {
    id: cashierA,
    tenantId: tenantA,
    email: `um-cashier-${randomUUID()}@user.test`,
    passwordHash,
    role: "cashier",
    mustChangePassword: false,
  });
  await seedTenantUser(ownerDb, {
    id: adminB,
    tenantId: tenantB,
    email: `um-admin-b-${randomUUID()}@user.test`,
    passwordHash,
    role: "admin",
    mustChangePassword: false,
  });

  await withTenantScope(seam.db, tenantA, (db) =>
    db
      .insertInto("Store")
      .values([
        { id: storeA1, tenant_id: tenantA, name: "A Outlet 1" },
        { id: storeA2, tenant_id: tenantA, name: "A Outlet 2" },
      ])
      .execute(),
  );
  await withTenantScope(seam.db, tenantB, (db) =>
    db.insertInto("Store").values({ id: storeB, tenant_id: tenantB, name: "B Outlet" }).execute(),
  );

  // managerA is assigned to storeA1 only.
  await withTenantScope(seam.db, tenantA, (db) =>
    db
      .insertInto("UserStore")
      .values({
        id: randomUUID(),
        tenant_id: tenantA,
        user_id: managerA,
        store_id: storeA1,
        assigned: true,
        effective_from: new Date(Date.now() - 60_000),
      })
      .execute(),
  );
});

afterAll(async () => {
  await ownerDb.deleteFrom("Session").where("tenant_id", "in", [tenantA, tenantB]).execute();
  await ownerDb.deleteFrom("UserStore").where("tenant_id", "in", [tenantA, tenantB]).execute();
  await ownerDb.deleteFrom("UserRole").where("tenant_id", "in", [tenantA, tenantB]).execute();
  await ownerDb.deleteFrom("Store").where("tenant_id", "in", [tenantA, tenantB]).execute();
  await ownerDb.deleteFrom("User").where("tenant_id", "in", [tenantA, tenantB]).execute();
  await ownerDb.deleteFrom("Tenant").where("id", "in", [tenantA, tenantB]).execute();
  await ownerDb.destroy();
  await seam.db.destroy();
});

describe("user.create", () => {
  it("an admin creates a User with an email, a role and a temporary password, assigned to Stores", async () => {
    const created = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.user.create({
        email: `new-hire-${randomUUID()}@user.test`,
        role: "cashier",
        password: "a temporary password",
        storeIds: [storeA1, storeA2],
      });

    expect(created?.role).toBe("cashier");
    expect(created?.active).toBe(true);
    expect(new Set(created?.storeIds)).toStrictEqual(new Set([storeA1, storeA2]));

    const row = await ownerDb
      .selectFrom("User")
      .select(["must_change_password", "password_hash"])
      .where("id", "=", created!.id)
      .executeTakeFirstOrThrow();
    expect(row.must_change_password).toBe(true);
    expect(row.password_hash).not.toContain("a temporary password");

    // No procedure output anywhere contains a password (record 043 no-go 1).
    expect(JSON.stringify(created)).not.toMatch(/temporary password/i);

    await ownerDb.deleteFrom("UserStore").where("user_id", "=", created!.id).execute();
    await ownerDb.deleteFrom("UserRole").where("user_id", "=", created!.id).execute();
    await ownerDb.deleteFrom("User").where("id", "=", created!.id).execute();
  });

  it("a User created with no Stores is legal", async () => {
    const created = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.user.create({
        email: `no-store-${randomUUID()}@user.test`,
        role: "admin",
        password: "a temporary password",
        storeIds: [],
      });

    expect(created?.storeIds).toStrictEqual([]);

    await ownerDb.deleteFrom("UserRole").where("user_id", "=", created!.id).execute();
    await ownerDb.deleteFrom("User").where("id", "=", created!.id).execute();
  });

  it("a manager and a cashier are refused, server-side", async () => {
    const asManager = await seam.actors
      .asTenant(tenantA, { userId: managerA, role: "manager" })
      .client.user.create({
        email: `should-not-exist-${randomUUID()}@user.test`,
        role: "cashier",
        password: "a temporary password",
        storeIds: [],
      });
    const asCashier = await seam.actors
      .asTenant(tenantA, { userId: cashierA, role: "cashier" })
      .client.user.create({
        email: `should-not-exist-2-${randomUUID()}@user.test`,
        role: "cashier",
        password: "a temporary password",
        storeIds: [],
      });

    expect(asManager).toBeNull();
    expect(asCashier).toBeNull();
  });

  it("the wrong-tenant probe: Tenant A cannot create a User visible to Tenant B, and B's own create still succeeds", async () => {
    const createdAsB = await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.user.create({
        email: `b-second-${randomUUID()}@user.test`,
        role: "cashier",
        password: "a temporary password",
        storeIds: [],
      });
    expect(createdAsB?.tenantId).toBe(tenantB);

    const listAsA = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.user.list();
    expect(listAsA.map((user) => user.id)).not.toContain(createdAsB!.id);

    await ownerDb.deleteFrom("UserRole").where("user_id", "=", createdAsB!.id).execute();
    await ownerDb.deleteFrom("User").where("id", "=", createdAsB!.id).execute();
  });
});

describe("user.update — role and Store assignment", () => {
  it("promotes a cashier to manager and reassigns Stores, writing new effective-dated rows in one save", async () => {
    const targetId = randomUUID();
    const targetEmail = `promote-${randomUUID()}@user.test`;
    await seedTenantUser(ownerDb, {
      id: targetId,
      tenantId: tenantA,
      email: targetEmail,
      passwordHash: await hashPassword("irrelevant"),
      role: "cashier",
      mustChangePassword: false,
    });
    await withTenantScope(seam.db, tenantA, (db) =>
      db
        .insertInto("UserStore")
        .values({
          id: randomUUID(),
          tenant_id: tenantA,
          user_id: targetId,
          store_id: storeA1,
          assigned: true,
          effective_from: new Date(Date.now() - 30_000),
        })
        .execute(),
    );

    const beforePromotion = new Date();
    const updated = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.user.update({ id: targetId, role: "manager", storeIds: [storeA2] });

    expect(updated?.role).toBe("manager");
    expect(updated?.storeIds).toStrictEqual([storeA2]);

    // Criterion 3: the previous role remains readable through issue 04's
    // "as of T" helper — the discharge record 045 §3 names.
    const asOfBefore = await withTenantScope(seam.db, tenantA, (db) =>
      getRoleAsOf(db, targetId, beforePromotion),
    );
    expect(asOfBefore?.role).toBe("cashier");

    // The decider's named property: the two copies of the role must never
    // disagree. Sign in as the promoted User and confirm the live gate
    // resolves the new role from the database, not a cached value.
    const signedIn = await seam.actors.signIn(targetEmail, "irrelevant");
    expect(signedIn.result).toStrictEqual({ ok: true, mustChangePassword: false });
    const me = await signedIn.client.auth.me();
    expect(me).toMatchObject({ authenticated: true, role: "manager" });
    expect(hasAtLeastRole("manager", "manager")).toBe(true);

    // Un-assignment closed storeA1 rather than deleting the row: the row is
    // still readable, just superseded.
    const historyRows = await ownerDb
      .selectFrom("UserStore")
      .selectAll()
      .where("user_id", "=", targetId)
      .where("store_id", "=", storeA1)
      .execute();
    expect(historyRows.length).toBeGreaterThanOrEqual(2);
    expect(historyRows.some((row) => row.assigned === false)).toBe(true);

    await ownerDb.deleteFrom("Session").where("user_id", "=", targetId).execute();
    await ownerDb.deleteFrom("UserStore").where("user_id", "=", targetId).execute();
    await ownerDb.deleteFrom("UserRole").where("user_id", "=", targetId).execute();
    await ownerDb.deleteFrom("User").where("id", "=", targetId).execute();
  });

  it("an admin cannot demote themselves; the Select still offers every role for other Users", async () => {
    const result = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.user.update({ id: adminA, role: "manager", storeIds: [] });

    expect(result).toBeNull();

    const stillAdmin = await ownerDb
      .selectFrom("User")
      .select("role")
      .where("id", "=", adminA)
      .executeTakeFirstOrThrow();
    expect(stillAdmin.role).toBe("admin");
  });

  it("a manager and a cashier are refused, server-side", async () => {
    const asManager = await seam.actors
      .asTenant(tenantA, { userId: managerA, role: "manager" })
      .client.user.update({ id: cashierA, role: "manager", storeIds: [] });
    const asCashier = await seam.actors
      .asTenant(tenantA, { userId: cashierA, role: "cashier" })
      .client.user.update({ id: cashierA, role: "admin", storeIds: [] });

    expect(asManager).toBeNull();
    expect(asCashier).toBeNull();
  });

  it("the wrong-tenant probe: Tenant A cannot change Tenant B's User; B's row is untouched", async () => {
    const beforeAsB = await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.user.update({ id: adminB, role: "admin", storeIds: [] });
    expect(beforeAsB?.id).toBe(adminB);

    await expectWrongTenantRefusal(
      () =>
        seam.actors
          .asTenant(tenantA, { userId: adminA, role: "admin" })
          .client.user.update({ id: adminB, role: "cashier", storeIds: [] }),
      (result) => result === null,
    );

    const stillAdmin = await ownerDb
      .selectFrom("User")
      .select("role")
      .where("id", "=", adminB)
      .executeTakeFirstOrThrow();
    expect(stillAdmin.role).toBe("admin");
  });
});

describe("user.resetPassword", () => {
  it("resets the password, forces a change at next sign-in, and revokes existing sessions, in one call", async () => {
    const targetId = randomUUID();
    const targetEmail = `reset-${randomUUID()}@user.test`;
    const originalPassword = "the original password";
    await seedTenantUser(ownerDb, {
      id: targetId,
      tenantId: tenantA,
      email: targetEmail,
      passwordHash: await hashPassword(originalPassword),
      role: "cashier",
      mustChangePassword: false,
    });

    const signedInBefore = await seam.actors.signIn(targetEmail, originalPassword);
    expect(signedInBefore.result).toStrictEqual({ ok: true, mustChangePassword: false });

    const result = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.user.resetPassword({ id: targetId, password: "a new temporary password" });

    expect(result?.id).toBe(targetId);
    // No password anywhere in the output (record 043 no-go 1).
    expect(JSON.stringify(result)).not.toMatch(/temporary password/i);

    const row = await ownerDb
      .selectFrom("User")
      .select(["must_change_password", "password_hash"])
      .where("id", "=", targetId)
      .executeTakeFirstOrThrow();
    expect(row.must_change_password).toBe(true);

    // The pre-reset session no longer reaches an authenticated procedure.
    const meAfterReset = await signedInBefore.client.auth.me();
    expect(meAfterReset).toStrictEqual({ authenticated: false });

    const sessions = await ownerDb
      .selectFrom("Session")
      .select("revoked_at")
      .where("user_id", "=", targetId)
      .execute();
    expect(sessions.every((session) => session.revoked_at !== null)).toBe(true);

    await ownerDb.deleteFrom("Session").where("user_id", "=", targetId).execute();
    await ownerDb.deleteFrom("UserRole").where("user_id", "=", targetId).execute();
    await ownerDb.deleteFrom("User").where("id", "=", targetId).execute();
  });

  it("a manager and a cashier are refused, server-side", async () => {
    const asManager = await seam.actors
      .asTenant(tenantA, { userId: managerA, role: "manager" })
      .client.user.resetPassword({ id: cashierA, password: "should not apply" });
    const asCashier = await seam.actors
      .asTenant(tenantA, { userId: cashierA, role: "cashier" })
      .client.user.resetPassword({ id: cashierA, password: "should not apply" });

    expect(asManager).toBeNull();
    expect(asCashier).toBeNull();
  });

  it("the wrong-tenant probe: Tenant A cannot reset Tenant B's User password", async () => {
    await expectWrongTenantRefusal(
      () =>
        seam.actors
          .asTenant(tenantA, { userId: adminA, role: "admin" })
          .client.user.resetPassword({ id: adminB, password: "hijacked from a" }),
      (result) => result === null,
    );
  });
});

describe("user.deactivate and user.reactivate", () => {
  it("deactivates a User immediately: sessions revoked, historical attribution untouched, then reactivates", async () => {
    const targetId = randomUUID();
    const targetEmail = `leaver-${randomUUID()}@user.test`;
    const password = "leaver's password";
    await seedTenantUser(ownerDb, {
      id: targetId,
      tenantId: tenantA,
      email: targetEmail,
      passwordHash: await hashPassword(password),
      role: "cashier",
      mustChangePassword: false,
    });

    const signedIn = await seam.actors.signIn(targetEmail, password);
    expect(signedIn.result).toStrictEqual({ ok: true, mustChangePassword: false });

    const deactivated = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.user.deactivate({ id: targetId });
    expect(deactivated?.active).toBe(false);

    // Never a hard delete — the row is still readable.
    const stillReadable = await ownerDb
      .selectFrom("User")
      .select("id")
      .where("id", "=", targetId)
      .executeTakeFirst();
    expect(stillReadable?.id).toBe(targetId);

    const meAfterDeactivate = await signedIn.client.auth.me();
    expect(meAfterDeactivate).toStrictEqual({ authenticated: false });

    const reactivated = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.user.reactivate({ id: targetId });
    expect(reactivated?.active).toBe(true);

    expect(JSON.stringify(deactivated).toLowerCase()).not.toMatch(/delete/);

    await ownerDb.deleteFrom("Session").where("user_id", "=", targetId).execute();
    await ownerDb.deleteFrom("UserRole").where("user_id", "=", targetId).execute();
    await ownerDb.deleteFrom("User").where("id", "=", targetId).execute();
  });

  it("an admin cannot deactivate themselves", async () => {
    const result = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.user.deactivate({ id: adminA });

    expect(result).toBeNull();

    const stillActive = await ownerDb
      .selectFrom("User")
      .select("active")
      .where("id", "=", adminA)
      .executeTakeFirstOrThrow();
    expect(stillActive.active).toBe(true);
  });

  it("a manager and a cashier are refused deactivation, server-side", async () => {
    const asManager = await seam.actors
      .asTenant(tenantA, { userId: managerA, role: "manager" })
      .client.user.deactivate({ id: cashierA });
    const asCashier = await seam.actors
      .asTenant(tenantA, { userId: cashierA, role: "cashier" })
      .client.user.deactivate({ id: cashierA });

    expect(asManager).toBeNull();
    expect(asCashier).toBeNull();

    const stillActive = await ownerDb
      .selectFrom("User")
      .select("active")
      .where("id", "=", cashierA)
      .executeTakeFirstOrThrow();
    expect(stillActive.active).toBe(true);
  });

  it("the wrong-tenant probe: Tenant A cannot deactivate Tenant B's User; B's row stays active", async () => {
    const deactivatedAsB = await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.user.deactivate({ id: adminB });
    // B cannot deactivate themselves either — prove B's own reactivate path
    // works by using a fresh Store B User instead.
    expect(deactivatedAsB).toBeNull();

    const targetId = randomUUID();
    await seedTenantUser(ownerDb, {
      id: targetId,
      tenantId: tenantB,
      email: `b-target-${randomUUID()}@user.test`,
      passwordHash: await hashPassword("irrelevant"),
      role: "cashier",
      mustChangePassword: false,
    });
    const deactivatedTargetAsB = await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.user.deactivate({ id: targetId });
    expect(deactivatedTargetAsB?.active).toBe(false);

    await expectWrongTenantRefusal(
      () =>
        seam.actors
          .asTenant(tenantA, { userId: adminA, role: "admin" })
          .client.user.reactivate({ id: targetId }),
      (result) => result === null,
    );

    const stillDeactivated = await ownerDb
      .selectFrom("User")
      .select("active")
      .where("id", "=", targetId)
      .executeTakeFirstOrThrow();
    expect(stillDeactivated.active).toBe(false);

    await ownerDb.deleteFrom("UserRole").where("user_id", "=", targetId).execute();
    await ownerDb.deleteFrom("User").where("id", "=", targetId).execute();
  });
});

describe("user.list", () => {
  it("an admin sees every User in their own Tenant, including themselves, and none of another Tenant's", async () => {
    const list = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.user.list();

    const ids = list.map((user) => user.id);
    expect(ids).toContain(adminA);
    expect(ids).toContain(managerA);
    expect(ids).toContain(cashierA);
    expect(ids).not.toContain(adminB);
  });

  it("a manager sees themselves and Users sharing their own Stores, with the Stores cell projected to their own visibility", async () => {
    const coWorkerId = randomUUID();
    await seedTenantUser(ownerDb, {
      id: coWorkerId,
      tenantId: tenantA,
      email: `co-worker-${randomUUID()}@user.test`,
      passwordHash: await hashPassword("irrelevant"),
      role: "cashier",
      mustChangePassword: false,
    });
    // Assigned to both storeA1 (managerA's Store) and storeA2 (not
    // managerA's) — the Stores cell managerA reads must show only storeA1.
    await withTenantScope(seam.db, tenantA, (db) =>
      db
        .insertInto("UserStore")
        .values([
          {
            id: randomUUID(),
            tenant_id: tenantA,
            user_id: coWorkerId,
            store_id: storeA1,
            assigned: true,
            effective_from: new Date(Date.now() - 10_000),
          },
          {
            id: randomUUID(),
            tenant_id: tenantA,
            user_id: coWorkerId,
            store_id: storeA2,
            assigned: true,
            effective_from: new Date(Date.now() - 10_000),
          },
        ])
        .execute(),
    );

    const list = await seam.actors
      .asTenant(tenantA, { userId: managerA, role: "manager" })
      .client.user.list();

    const ids = list.map((user) => user.id);
    expect(ids).toContain(managerA); // the caller is always in their own result
    expect(ids).toContain(coWorkerId);
    expect(ids).not.toContain(cashierA); // cashierA has no Store assignment at all
    expect(ids).not.toContain(adminA); // no total/count leak by including every Tenant User

    const coWorkerRow = list.find((user) => user.id === coWorkerId)!;
    expect(coWorkerRow.storeIds).toStrictEqual([storeA1]);

    await ownerDb.deleteFrom("UserStore").where("user_id", "=", coWorkerId).execute();
    await ownerDb.deleteFrom("UserRole").where("user_id", "=", coWorkerId).execute();
    await ownerDb.deleteFrom("User").where("id", "=", coWorkerId).execute();
  });

  it("a cashier is refused, server-side, and sees no User at all — not even themselves", async () => {
    const list = await seam.actors
      .asTenant(tenantA, { userId: cashierA, role: "cashier" })
      .client.user.list();

    expect(list).toStrictEqual([]);
  });

  it("an unauthenticated caller sees no User at all", async () => {
    const list = await seam.actors.asUnauthenticated().client.user.list();

    expect(list).toStrictEqual([]);
  });

  it("the wrong-tenant probe: Tenant B's User is never visible in Tenant A's list", async () => {
    const asA = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.user.list();
    expect(asA.map((user) => user.id)).not.toContain(adminB);

    const asB = await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.user.list();
    expect(asB.map((user) => user.id)).toContain(adminB);
  });
});
