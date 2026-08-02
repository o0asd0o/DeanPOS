import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { findSessionById } from "../../src/auth/db-operations/queries/find-session-by-id.query.ts";
import { findUserByEmailForSignIn } from "../../src/auth/db-operations/queries/find-user-by-email-for-sign-in.query.ts";
import {
  createDb,
  type DatabaseInstance,
  withLoginScope,
  withSessionScope,
  withTenantScope,
} from "../../src/db/client.ts";
import { hashPassword } from "../../src/common/password.ts";

// Proves RLS itself is doing the work, not application-level filtering
// (PRD Testing Decisions) — every query here goes through `appDb`, the
// restricted role, with no `WHERE` clause the repository added by hand.
const ownerDb: DatabaseInstance = createDb({ databaseUrl: process.env.DATABASE_URI! });
const appDb: DatabaseInstance = createDb({ databaseUrl: process.env.APP_DATABASE_URI! });

const tenantId = randomUUID();
const userId = randomUUID();
const sessionId = randomUUID();
const email = `rls-${randomUUID()}@auth.test`;
const secondUserId = randomUUID();
const secondEmail = `rls-${randomUUID()}@auth.test`;
// Deliberately equal to `tenantId` — the value the deleted `OR` branch of
// "session_tenant_update" would have matched on. Owned by a different
// tenant, so a real cross-tenant update is what the regression test proves.
const collidingSessionId = tenantId;
const otherTenantId = randomUUID();
const otherUserId = randomUUID();

beforeAll(async () => {
  await ownerDb.insertInto("Tenant").values({ id: tenantId, name: "RLS Auth Tenant" }).execute();
  await ownerDb
    .insertInto("Tenant")
    .values({ id: otherTenantId, name: "RLS Auth Other Tenant" })
    .execute();
  await ownerDb
    .insertInto("User")
    .values({
      id: otherUserId,
      tenant_id: otherTenantId,
      email: `rls-${randomUUID()}@auth.test`,
      password_hash: await hashPassword("irrelevant"),
      role: "admin",
    })
    .execute();
  await ownerDb
    .insertInto("Session")
    .values({
      id: collidingSessionId,
      user_id: otherUserId,
      tenant_id: otherTenantId,
      expires_at: new Date(Date.now() + 60_000),
    })
    .execute();
  await ownerDb
    .insertInto("User")
    .values({
      id: userId,
      tenant_id: tenantId,
      email,
      password_hash: await hashPassword("irrelevant"),
      role: "admin",
    })
    .execute();
  await ownerDb
    .insertInto("User")
    .values({
      id: secondUserId,
      tenant_id: tenantId,
      email: secondEmail,
      password_hash: await hashPassword("irrelevant"),
      role: "admin",
    })
    .execute();
  await ownerDb
    .insertInto("Session")
    .values({
      id: sessionId,
      user_id: userId,
      tenant_id: tenantId,
      expires_at: new Date(Date.now() + 60_000),
    })
    .execute();
});

afterAll(async () => {
  await ownerDb.deleteFrom("Session").where("id", "=", sessionId).execute();
  await ownerDb.deleteFrom("Session").where("id", "=", collidingSessionId).execute();
  await ownerDb.deleteFrom("User").where("id", "=", userId).execute();
  await ownerDb.deleteFrom("User").where("id", "=", secondUserId).execute();
  await ownerDb.deleteFrom("User").where("id", "=", otherUserId).execute();
  await ownerDb.deleteFrom("Tenant").where("id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Tenant").where("id", "=", otherTenantId).execute();
  await ownerDb.destroy();
  await appDb.destroy();
});

describe("findUserByEmailForSignIn: RLS, not application filtering", () => {
  it("finds the account by email with no Tenant scope known ahead of time", async () => {
    const user = await findUserByEmailForSignIn(appDb, email);
    expect(user?.id).toBe(userId);
  });

  it("a non-matching email returns nothing, not another User's row", async () => {
    const user = await findUserByEmailForSignIn(appDb, `not-${email}`);
    expect(user).toBeUndefined();
  });

  it("an unscoped connection issuing the same select directly, with no email predicate honoured by RLS, sees nothing", async () => {
    const rows = await appDb.selectFrom("User").selectAll().execute();
    expect(rows).toStrictEqual([]);
  });
});

describe("findSessionById: RLS, not application filtering", () => {
  it("finds the session by id with no Tenant scope known ahead of time", async () => {
    const session = await findSessionById(appDb, sessionId);
    expect(session?.id).toBe(sessionId);
  });

  it("a non-matching session id returns nothing", async () => {
    const session = await findSessionById(appDb, randomUUID());
    expect(session).toBeUndefined();
  });

  it("an unscoped connection issuing the same select directly sees nothing", async () => {
    const rows = await appDb.selectFrom("Session").selectAll().execute();
    expect(rows).toStrictEqual([]);
  });

  it("a normal tenant-scoped connection can also read its own Session by tenant_id", async () => {
    const rows = await withTenantScope(appDb, tenantId, (db) =>
      db.selectFrom("Session").selectAll().execute(),
    );
    expect(rows.map((r) => r.id)).toStrictEqual([sessionId]);
  });
});

describe("record 031: named pre-auth scopes stay narrower than tenant scope", () => {
  it("withSessionScope cannot read User or Store", async () => {
    const users = await withSessionScope(appDb, sessionId, (db) =>
      db.selectFrom("User").selectAll().execute(),
    );
    const stores = await withSessionScope(appDb, sessionId, (db) =>
      db.selectFrom("Store").selectAll().execute(),
    );
    expect(users).toStrictEqual([]);
    expect(stores).toStrictEqual([]);
  });

  it("withLoginScope reads exactly the one matching row, not the whole tenant", async () => {
    const rows = await withLoginScope(appDb, email, (db) =>
      db.selectFrom("User").selectAll().execute(),
    );
    expect(rows.map((r) => r.id)).toStrictEqual([userId]);
  });

  it("a tenant-scoped connection cannot UPDATE the Session whose id equals its own tenant id", async () => {
    const result = await withTenantScope(appDb, tenantId, (db) =>
      db
        .updateTable("Session")
        .set({ last_seen_at: new Date() })
        .where("id", "=", collidingSessionId)
        .executeTakeFirst(),
    );
    expect(result.numUpdatedRows).toBe(0n);
  });
});
