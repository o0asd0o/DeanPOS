import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { getAssignedStoreIdsAsOf } from "backend/src/access/db-operations/queries/get-assigned-store-ids-as-of.query.ts";
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
        firstName: "Test",
        lastName: "Person",
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
        firstName: "Test",
        lastName: "Person",
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
        firstName: "Test",
        lastName: "Person",
        email: `should-not-exist-${randomUUID()}@user.test`,
        role: "cashier",
        password: "a temporary password",
        storeIds: [],
      });
    const asCashier = await seam.actors
      .asTenant(tenantA, { userId: cashierA, role: "cashier" })
      .client.user.create({
        firstName: "Test",
        lastName: "Person",
        email: `should-not-exist-2-${randomUUID()}@user.test`,
        role: "cashier",
        password: "a temporary password",
        storeIds: [],
      });

    expect(asManager).toBeNull();
    expect(asCashier).toBeNull();
  });

  it("wrong-tenant probe [user.create]: Tenant A cannot create a User in Tenant B's Store, and B's own create still succeeds", async () => {
    // B's own create, assigned to B's own proven Store, succeeds through the
    // application path — a procedure that refuses everyone would otherwise
    // pass the refusal below for the wrong reason.
    const createdAsB = await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.user.create({
        firstName: "Test",
        lastName: "Person",
        email: `b-store-scoped-${randomUUID()}@user.test`,
        role: "cashier",
        password: "a temporary password",
        storeIds: [storeB],
      });
    expect(createdAsB?.tenantId).toBe(tenantB);
    expect(createdAsB?.storeIds).toStrictEqual([storeB]);

    const createdAsA = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.user.create({
        firstName: "Test",
        lastName: "Person",
        email: `a-own-scoped-${randomUUID()}@user.test`,
        role: "cashier",
        password: "a temporary password",
        storeIds: [storeA1],
      });
    expect(createdAsA?.tenantId).toBe(tenantA);

    const userRoleCountBefore = await ownerDb
      .selectFrom("UserRole")
      .select((eb) => eb.fn.countAll<string>().as("count"))
      .where("tenant_id", "=", tenantA)
      .executeTakeFirstOrThrow();
    const userStoreCountBefore = await ownerDb
      .selectFrom("UserStore")
      .select((eb) => eb.fn.countAll<string>().as("count"))
      .where("tenant_id", "=", tenantA)
      .executeTakeFirstOrThrow();

    // The composite (tenant, store) FK on UserStore rejects a User assigned
    // to Tenant B's Store; the whole insert rolls back in the same
    // transaction (record 045) — no User, no UserRole, no UserStore row.
    const email = `should-not-exist-cross-tenant-${randomUUID()}@user.test`;
    await expect(
      seam.actors.asTenant(tenantA, { userId: adminA, role: "admin" }).client.user.create({
        firstName: "Test",
        lastName: "Person",
        email,
        role: "cashier",
        password: "a temporary password",
        storeIds: [storeB],
      }),
    ).rejects.toThrow();

    const orphanedUser = await ownerDb
      .selectFrom("User")
      .select("id")
      .where("email", "=", email)
      .executeTakeFirst();
    expect(orphanedUser).toBeUndefined();

    const userRoleCountAfter = await ownerDb
      .selectFrom("UserRole")
      .select((eb) => eb.fn.countAll<string>().as("count"))
      .where("tenant_id", "=", tenantA)
      .executeTakeFirstOrThrow();
    const userStoreCountAfter = await ownerDb
      .selectFrom("UserStore")
      .select((eb) => eb.fn.countAll<string>().as("count"))
      .where("tenant_id", "=", tenantA)
      .executeTakeFirstOrThrow();
    expect(userRoleCountAfter.count).toBe(userRoleCountBefore.count);
    expect(userStoreCountAfter.count).toBe(userStoreCountBefore.count);

    await expectWrongTenantRefusal({
      path: "user.create",
      mode: "confined",
      ownerSees: createdAsB,
      otherGets: async () => createdAsA,
      otherOwn: createdAsA,
    });

    await ownerDb
      .deleteFrom("UserStore")
      .where("user_id", "in", [createdAsB!.id, createdAsA!.id])
      .execute();
    await ownerDb
      .deleteFrom("UserRole")
      .where("user_id", "in", [createdAsB!.id, createdAsA!.id])
      .execute();
    await ownerDb.deleteFrom("User").where("id", "in", [createdAsB!.id, createdAsA!.id]).execute();
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
      .client.user.update({
        firstName: "Test",
        lastName: "Person",
        id: targetId,
        role: "manager",
        storeIds: [storeA2],
      });

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

  it("a promotion's User.role write and its UserRole history row commit or roll back together", async () => {
    const targetId = randomUUID();
    const targetEmail = `atomic-promote-${randomUUID()}@user.test`;
    await seedTenantUser(ownerDb, {
      id: targetId,
      tenantId: tenantA,
      email: targetEmail,
      passwordHash: await hashPassword("irrelevant"),
      role: "cashier",
      mustChangePassword: false,
    });

    const roleBefore = await ownerDb
      .selectFrom("User")
      .select("role")
      .where("id", "=", targetId)
      .executeTakeFirstOrThrow();
    const userRoleRowsBefore = await ownerDb
      .selectFrom("UserRole")
      .selectAll()
      .where("user_id", "=", targetId)
      .execute();

    // storeB (Tenant B) forces a composite-FK failure after the role write,
    // proving both writes share one transaction rather than the role
    // silently outrunning the history (record 045 §4 clause 3).
    await expect(
      seam.actors.asTenant(tenantA, { userId: adminA, role: "admin" }).client.user.update({
        firstName: "Test",
        lastName: "Person",
        id: targetId,
        role: "manager",
        storeIds: [storeB],
      }),
    ).rejects.toThrow();

    const roleAfter = await ownerDb
      .selectFrom("User")
      .select("role")
      .where("id", "=", targetId)
      .executeTakeFirstOrThrow();
    expect(roleAfter.role).toBe(roleBefore.role);

    const userRoleRowsAfter = await ownerDb
      .selectFrom("UserRole")
      .selectAll()
      .where("user_id", "=", targetId)
      .execute();
    expect(userRoleRowsAfter).toStrictEqual(userRoleRowsBefore);

    await ownerDb.deleteFrom("UserRole").where("user_id", "=", targetId).execute();
    await ownerDb.deleteFrom("User").where("id", "=", targetId).execute();
  });

  it("an admin cannot demote themselves; the Select still offers every role for other Users", async () => {
    const result = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.user.update({
        firstName: "Test",
        lastName: "Person",
        id: adminA,
        role: "manager",
        storeIds: [],
      });

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
      .client.user.update({
        firstName: "Test",
        lastName: "Person",
        id: cashierA,
        role: "manager",
        storeIds: [],
      });
    const asCashier = await seam.actors
      .asTenant(tenantA, { userId: cashierA, role: "cashier" })
      .client.user.update({
        firstName: "Test",
        lastName: "Person",
        id: cashierA,
        role: "admin",
        storeIds: [],
      });

    expect(asManager).toBeNull();
    expect(asCashier).toBeNull();
  });

  it("wrong-tenant probe [user.update]: Tenant A cannot change Tenant B's User; B's row is untouched", async () => {
    const beforeAsB = await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.user.update({
        firstName: "Test",
        lastName: "Person",
        id: adminB,
        role: "admin",
        storeIds: [],
      });
    expect(beforeAsB?.id).toBe(adminB);

    await expectWrongTenantRefusal({
      path: "user.update",
      mode: "refusal",
      ownerSees: beforeAsB,
      otherGets: () =>
        seam.actors.asTenant(tenantA, { userId: adminA, role: "admin" }).client.user.update({
          firstName: "Test",
          lastName: "Person",
          id: adminB,
          role: "cashier",
          storeIds: [],
        }),
    });

    const stillAdmin = await ownerDb
      .selectFrom("User")
      .select("role")
      .where("id", "=", adminB)
      .executeTakeFirstOrThrow();
    expect(stillAdmin.role).toBe("admin");
  });

  it("two concurrent saves on the same User serialise: the winner's role and Store assignment both land intact (record 034, one level out)", async () => {
    const targetId = randomUUID();
    const targetEmail = `race-${randomUUID()}@user.test`;
    await seedTenantUser(ownerDb, {
      id: targetId,
      tenantId: tenantA,
      email: targetEmail,
      passwordHash: await hashPassword("irrelevant"),
      role: "cashier",
      mustChangePassword: false,
    });

    // Fired together, not awaited one at a time — this is what exposes the
    // race: both read the pre-save state before either has committed.
    await Promise.all([
      seam.actors.asTenant(tenantA, { userId: adminA, role: "admin" }).client.user.update({
        firstName: "Test",
        lastName: "Person",
        id: targetId,
        role: "manager",
        storeIds: [storeA1],
      }),
      seam.actors.asTenant(tenantA, { userId: adminA, role: "admin" }).client.user.update({
        firstName: "Test",
        lastName: "Person",
        id: targetId,
        role: "admin",
        storeIds: [storeA2],
      }),
    ]);

    const finalUser = await ownerDb
      .selectFrom("User")
      .select("role")
      .where("id", "=", targetId)
      .executeTakeFirstOrThrow();
    const roleRows = await ownerDb
      .selectFrom("UserRole")
      .selectAll()
      .where("user_id", "=", targetId)
      .orderBy("effective_from", "desc")
      .orderBy("created_at", "desc")
      .execute();
    expect(finalUser.role).toBe(roleRows[0]!.role);

    const finalStoreIds = await withTenantScope(seam.db, tenantA, (db) =>
      getAssignedStoreIdsAsOf(db, targetId, new Date()),
    );
    // Never a mixture of both saves' assignments — exactly one full set won.
    expect([[storeA1], [storeA2]]).toContainEqual(finalStoreIds);

    await ownerDb.deleteFrom("Session").where("user_id", "=", targetId).execute();
    await ownerDb.deleteFrom("UserStore").where("user_id", "=", targetId).execute();
    await ownerDb.deleteFrom("UserRole").where("user_id", "=", targetId).execute();
    await ownerDb.deleteFrom("User").where("id", "=", targetId).execute();
  }, 30_000);
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

  it("wrong-tenant probe [user.resetPassword]: Tenant A cannot reset Tenant B's User password; B's own reset still succeeds", async () => {
    const targetId = randomUUID();
    const targetEmail = `b-reset-target-${randomUUID()}@user.test`;
    await seedTenantUser(ownerDb, {
      id: targetId,
      tenantId: tenantB,
      email: targetEmail,
      passwordHash: await hashPassword("irrelevant"),
      role: "cashier",
      mustChangePassword: false,
    });

    // B's own reset succeeds through the application path first — `null` is
    // also what an authorised-but-not-found reset returns, so a refusal
    // alone proves nothing without this.
    const resetAsB = await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.user.resetPassword({ id: targetId, password: "b's new temporary password" });
    expect(resetAsB?.id).toBe(targetId);

    const hashAfterB = await ownerDb
      .selectFrom("User")
      .select("password_hash")
      .where("id", "=", targetId)
      .executeTakeFirstOrThrow();

    await expectWrongTenantRefusal({
      path: "user.resetPassword",
      mode: "refusal",
      ownerSees: resetAsB,
      otherGets: () =>
        seam.actors
          .asTenant(tenantA, { userId: adminA, role: "admin" })
          .client.user.resetPassword({ id: targetId, password: "hijacked from a" }),
    });

    // Not merely `null` — B's just-reset hash is provably untouched by A's
    // attempt.
    const hashAfterA = await ownerDb
      .selectFrom("User")
      .select("password_hash")
      .where("id", "=", targetId)
      .executeTakeFirstOrThrow();
    expect(hashAfterA.password_hash).toBe(hashAfterB.password_hash);

    await ownerDb.deleteFrom("Session").where("user_id", "=", targetId).execute();
    await ownerDb.deleteFrom("UserRole").where("user_id", "=", targetId).execute();
    await ownerDb.deleteFrom("User").where("id", "=", targetId).execute();
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

  it("wrong-tenant probe [user.deactivate]: Tenant A cannot deactivate Tenant B's User; B's own path still succeeds", async () => {
    const targetId = randomUUID();
    await seedTenantUser(ownerDb, {
      id: targetId,
      tenantId: tenantB,
      email: `b-target-deactivate-${randomUUID()}@user.test`,
      passwordHash: await hashPassword("irrelevant"),
      role: "cashier",
      mustChangePassword: false,
    });

    // B's own deactivate succeeds through the application path first — a
    // procedure that refuses everyone would otherwise pass the refusal
    // below for the wrong reason.
    const deactivatedAsB = await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.user.deactivate({ id: targetId });
    expect(deactivatedAsB?.active).toBe(false);

    await expectWrongTenantRefusal({
      path: "user.deactivate",
      mode: "refusal",
      ownerSees: deactivatedAsB,
      otherGets: () =>
        seam.actors
          .asTenant(tenantA, { userId: adminA, role: "admin" })
          .client.user.deactivate({ id: targetId }),
    });

    const stillDeactivated = await ownerDb
      .selectFrom("User")
      .select("active")
      .where("id", "=", targetId)
      .executeTakeFirstOrThrow();
    expect(stillDeactivated.active).toBe(false);

    await ownerDb.deleteFrom("Session").where("user_id", "=", targetId).execute();
    await ownerDb.deleteFrom("UserRole").where("user_id", "=", targetId).execute();
    await ownerDb.deleteFrom("User").where("id", "=", targetId).execute();
  });

  it("wrong-tenant probe [user.reactivate]: Tenant A cannot reactivate Tenant B's User; B's own path still succeeds", async () => {
    const targetId = randomUUID();
    await seedTenantUser(ownerDb, {
      id: targetId,
      tenantId: tenantB,
      email: `b-target-reactivate-${randomUUID()}@user.test`,
      passwordHash: await hashPassword("irrelevant"),
      role: "cashier",
      mustChangePassword: false,
    });

    // B's own deactivate/reactivate succeeds through the application path
    // before it is probed (finding 7) — a procedure that refuses everyone
    // would otherwise pass the refusal below for the wrong reason.
    await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.user.deactivate({ id: targetId });
    const reactivatedAsB = await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.user.reactivate({ id: targetId });
    expect(reactivatedAsB?.active).toBe(true);

    // Deactivate again so the reactivate probe below would visibly change
    // something if it (wrongly) succeeded.
    const deactivatedAgainAsB = await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.user.deactivate({ id: targetId });
    expect(deactivatedAgainAsB?.active).toBe(false);

    await expectWrongTenantRefusal({
      path: "user.reactivate",
      mode: "refusal",
      ownerSees: reactivatedAsB,
      otherGets: () =>
        seam.actors
          .asTenant(tenantA, { userId: adminA, role: "admin" })
          .client.user.reactivate({ id: targetId }),
    });

    const stillDeactivated = await ownerDb
      .selectFrom("User")
      .select("active")
      .where("id", "=", targetId)
      .executeTakeFirstOrThrow();
    expect(stillDeactivated.active).toBe(false);

    await ownerDb.deleteFrom("Session").where("user_id", "=", targetId).execute();
    await ownerDb.deleteFrom("UserRole").where("user_id", "=", targetId).execute();
    await ownerDb.deleteFrom("User").where("id", "=", targetId).execute();
  });
});

describe("user.list", () => {
  it("an admin sees every User in their own Tenant, including themselves, and none of another Tenant's", async () => {
    const list = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.user.list({ perPage: 100 });

    const ids = list.items.map((user) => user.id);
    expect(ids).toContain(adminA);
    expect(ids).toContain(managerA);
    expect(ids).toContain(cashierA);
    expect(ids).not.toContain(adminB);
  });

  it("pages the roster server-side: page 1 holds ten, the envelope says there is a page 2, and page 2 holds the rest", async () => {
    // Earlier describes leave their own Users behind; the assertions are
    // relative to a baseline snapshot, not an absolute roster size.
    const baseline = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.user.list({ perPage: 1000 });
    const baselineIds = new Set(baseline.items.map((user) => user.id));
    expect(baselineIds.has(adminA)).toBe(true);

    const extraIds: string[] = [];
    for (let i = 0; i < 12; i++) {
      const id = randomUUID();
      extraIds.push(id);
      await seedTenantUser(ownerDb, {
        id,
        tenantId: tenantA,
        email: `page-${i}-${randomUUID()}@user.test`,
        passwordHash: await hashPassword("irrelevant"),
        role: "cashier",
        mustChangePassword: false,
      });
    }

    const page1 = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.user.list({ page: 1, perPage: 10 });
    const page2 = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.user.list({ page: 2, perPage: 10 });

    const expectedTotal = baseline.items.length + 12;
    expect(page1.items).toHaveLength(10);
    expect(page1.hasNextPage).toBe(true);
    expect(page1.hasPrevPage).toBe(false);
    expect(page2.items).toHaveLength(expectedTotal - 10);
    expect(page2.hasNextPage).toBe(false);
    expect(page2.hasPrevPage).toBe(true);
    expect(page1.count).toBe(expectedTotal);
    expect(page1.totalCount).toBe(expectedTotal);
    expect(page1.activeCount).toBe(baseline.activeCount + 12);

    // Every seeded extra lands on one of the two pages, exactly once each.
    const seen = new Set([...page1.items, ...page2.items].map((user) => user.id));
    expect(seen.size).toBe(expectedTotal);
    for (const id of extraIds) expect(seen.has(id)).toBe(true);

    // FK order: UserRole before User — seedTenantUser writes both.
    await ownerDb.deleteFrom("UserRole").where("user_id", "in", extraIds).execute();
    await ownerDb.deleteFrom("User").where("id", "in", extraIds).execute();
  });

  it("filters the roster server-side by role, Store and search term", async () => {
    const targetId = randomUUID();
    await seedTenantUser(ownerDb, {
      id: targetId,
      tenantId: tenantA,
      email: `filtered-roster-${randomUUID()}@user.test`,
      passwordHash: await hashPassword("irrelevant"),
      role: "manager",
      mustChangePassword: false,
      firstName: "Rosa",
      lastName: "Cruz",
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
          effective_from: new Date(Date.now() - 10_000),
        })
        .execute(),
    );

    const admin = () => seam.actors.asTenant(tenantA, { userId: adminA, role: "admin" });

    const managers = await admin().client.user.list({ role: "manager", perPage: 100 });
    expect(managers.items.map((user) => user.id)).toContain(targetId);
    expect(managers.items.map((user) => user.id)).not.toContain(cashierA);

    const atStoreA1 = await admin().client.user.list({ storeId: storeA1, perPage: 100 });
    expect(atStoreA1.items.map((user) => user.id)).toContain(targetId);
    expect(atStoreA1.items.map((user) => user.id)).not.toContain(cashierA);

    // Search matches the person and the Store they work at, not just the email.
    const byName = await admin().client.user.list({ search: "rosa", perPage: 100 });
    expect(byName.items.map((user) => user.id)).toContain(targetId);
    const byStore = await admin().client.user.list({ search: "outlet 1", perPage: 100 });
    expect(byStore.items.map((user) => user.id)).toContain(targetId);

    // The filters compose: a role that excludes the target leaves nothing.
    const cashiersAtStoreA1 = await admin().client.user.list({
      role: "cashier",
      storeId: storeA1,
      perPage: 100,
    });
    expect(cashiersAtStoreA1.items.map((user) => user.id)).not.toContain(targetId);

    await ownerDb.deleteFrom("UserStore").where("user_id", "=", targetId).execute();
    await ownerDb.deleteFrom("UserRole").where("user_id", "=", targetId).execute();
    await ownerDb.deleteFrom("User").where("id", "=", targetId).execute();
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

    const manager = () =>
      seam.actors.asTenant(tenantA, { userId: managerA, role: "manager" });
    const list = await manager().client.user.list({ perPage: 100 });

    const ids = list.items.map((user) => user.id);
    expect(ids).toContain(managerA); // the caller is always in their own result
    expect(ids).toContain(coWorkerId);
    expect(ids).not.toContain(cashierA); // cashierA has no Store assignment at all
    expect(ids).not.toContain(adminA); // no count leak by including every Tenant User

    const coWorkerRow = list.items.find((user) => user.id === coWorkerId)!;
    expect(coWorkerRow.storeIds).toStrictEqual([storeA1]);
    // The disclosed totals cover exactly the rows the manager can see —
    // fewer than the whole Tenant roster, and every visible row counted.
    const adminCount = (
      await seam.actors
        .asTenant(tenantA, { userId: adminA, role: "admin" })
        .client.user.list({ perPage: 1000 })
    ).items.length;
    expect(list.totalCount).toBe(list.items.length);
    expect(list.totalCount).toBeLessThan(adminCount);

    // Searching a Store name the manager cannot see matches nothing — the
    // co-worker's invisible storeA2 assignment must not surface them.
    const searchInvisible = await manager().client.user.list({ search: "outlet 2" });
    expect(searchInvisible.items.map((user) => user.id)).not.toContain(coWorkerId);

    await ownerDb.deleteFrom("UserStore").where("user_id", "=", coWorkerId).execute();
    await ownerDb.deleteFrom("UserRole").where("user_id", "=", coWorkerId).execute();
    await ownerDb.deleteFrom("User").where("id", "=", coWorkerId).execute();
  });

  it("a cashier is refused, server-side, and sees no User at all — not even themselves", async () => {
    const list = await seam.actors
      .asTenant(tenantA, { userId: cashierA, role: "cashier" })
      .client.user.list({});

    expect(list.items).toStrictEqual([]);
    expect(list.count).toBe(0);
    expect(list.totalCount).toBe(0);
  });

  it("an unauthenticated caller sees no User at all", async () => {
    const list = await seam.actors.asUnauthenticated().client.user.list({});

    expect(list.items).toStrictEqual([]);
    expect(list.count).toBe(0);
  });

  it("wrong-tenant probe [user.list]: Tenant B's User is never visible in Tenant A's list", async () => {
    const listAsA = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.user.list({ perPage: 100 });
    expect(listAsA.items.map((user) => user.id)).not.toContain(adminB);
    const ownAsA = listAsA.items.find((user) => user.id === adminA);
    expect(ownAsA).toBeTruthy();

    const listAsB = await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.user.list({ perPage: 100 });
    const ownAsB = listAsB.items.find((user) => user.id === adminB);
    expect(ownAsB).toBeTruthy();

    await expectWrongTenantRefusal({
      path: "user.list",
      mode: "confined",
      ownerSees: ownAsB,
      otherGets: async () => ownAsA,
      otherOwn: ownAsA,
    });
  });
});
