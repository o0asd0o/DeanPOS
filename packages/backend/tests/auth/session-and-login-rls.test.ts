import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { findSessionById } from "../../src/auth/db-operations/queries/find-session-by-id.query.ts";
import { findUserByEmailForSignIn } from "../../src/auth/db-operations/queries/find-user-by-email-for-sign-in.query.ts";
import { createDb, type DatabaseInstance, withTenantScope } from "../../src/db/client.ts";
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

beforeAll(async () => {
  await ownerDb.insertInto("Tenant").values({ id: tenantId, name: "RLS Auth Tenant" }).execute();
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
  await ownerDb.deleteFrom("User").where("id", "=", userId).execute();
  await ownerDb.deleteFrom("Tenant").where("id", "=", tenantId).execute();
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
