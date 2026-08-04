import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { createDb, withTenantScope } from "backend/src/db/client.ts";
import { hashPassword } from "backend/src/common/password.ts";
import { insertUserStore } from "backend/src/access/db-operations/commands/insert-user-store.command.ts";
import { seedTenantUser } from "../src/seed-tenant-user.ts";
import { createTestSeam } from "../src/test-seam.ts";

// `auth.me` is what the `_shell` route's `beforeLoad` guard reads (record
// 030) — the client cannot read the httpOnly cookie itself.
const seam = createTestSeam();
const ownerDb = createDb({ databaseUrl: process.env.DATABASE_URI! });

const tenantId = randomUUID();
const userId = randomUUID();
const email = `me-${randomUUID()}@sign-in.test`;
const password = "correct horse battery staple";

beforeAll(async () => {
  await ownerDb.insertInto("Tenant").values({ id: tenantId, name: "Me Tenant" }).execute();
  await seedTenantUser(ownerDb, {
    id: userId,
    tenantId,
    email,
    passwordHash: await hashPassword(password),
    mustChangePassword: false,
    role: "admin",
  });
});

afterAll(async () => {
  await ownerDb.deleteFrom("Session").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("UserRole").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("User").where("id", "=", userId).execute();
  await ownerDb.deleteFrom("Tenant").where("id", "=", tenantId).execute();
  await ownerDb.destroy();
  await seam.db.destroy();
});

describe("auth.me", () => {
  it("reports unauthenticated with no session cookie", async () => {
    const client = seam.actors.withCookie(null, seam.actors.adminOrigin);
    await expect(client.auth.me()).resolves.toStrictEqual({ authenticated: false });
  });

  it("reports authenticated and mustChangePassword for a signed-in session", async () => {
    const { client } = await seam.actors.signIn(email, password);
    await expect(client.auth.me()).resolves.toStrictEqual({
      authenticated: true,
      mustChangePassword: false,
      role: "admin",
      userId,
      email,
      firstName: "",
      lastName: "",
      stores: [],
    });
  });

  it("stays reachable even while mustChangePassword is true", async () => {
    const tempUserId = randomUUID();
    const tempEmail = `me-temp-${randomUUID()}@sign-in.test`;
    await seedTenantUser(ownerDb, {
      id: tempUserId,
      tenantId,
      email: tempEmail,
      passwordHash: await hashPassword("temp-password-1"),
      role: "cashier",
    });

    const { client } = await seam.actors.signIn(tempEmail, "temp-password-1");
    await expect(client.auth.me()).resolves.toStrictEqual({
      authenticated: true,
      mustChangePassword: true,
      role: "cashier",
      userId: tempUserId,
      email: tempEmail,
      firstName: "",
      lastName: "",
      stores: [],
    });

    await ownerDb.deleteFrom("Session").where("user_id", "=", tempUserId).execute();
    await ownerDb.deleteFrom("UserRole").where("user_id", "=", tempUserId).execute();
    await ownerDb.deleteFrom("User").where("id", "=", tempUserId).execute();
  });

  it("carries the caller's own name and assigned Stores, never anyone else's", async () => {
    const namedUserId = randomUUID();
    const namedEmail = `me-named-${randomUUID()}@sign-in.test`;
    const storeId = randomUUID();
    const otherStoreId = randomUUID();
    await withTenantScope(ownerDb, tenantId, (db) =>
      db
        .insertInto("Store")
        .values([
          { id: storeId, tenant_id: tenantId, name: "Assigned Store" },
          { id: otherStoreId, tenant_id: tenantId, name: "Unassigned Store" },
        ])
        .execute(),
    );
    await seedTenantUser(ownerDb, {
      id: namedUserId,
      tenantId,
      email: namedEmail,
      passwordHash: await hashPassword("temp-password-1"),
      mustChangePassword: false,
      role: "cashier",
      firstName: "Ada",
      lastName: "Lovelace",
    });
    await withTenantScope(ownerDb, tenantId, (db) =>
      insertUserStore(db, {
        id: randomUUID(),
        tenantId,
        userId: namedUserId,
        storeId,
        assigned: true,
        effectiveFrom: new Date(),
      }),
    );

    const { client } = await seam.actors.signIn(namedEmail, "temp-password-1");
    await expect(client.auth.me()).resolves.toStrictEqual({
      authenticated: true,
      mustChangePassword: false,
      role: "cashier",
      userId: namedUserId,
      email: namedEmail,
      firstName: "Ada",
      lastName: "Lovelace",
      stores: [{ id: storeId, name: "Assigned Store" }],
    });

    await ownerDb.deleteFrom("Session").where("user_id", "=", namedUserId).execute();
    await ownerDb.deleteFrom("UserRole").where("user_id", "=", namedUserId).execute();
    await ownerDb.deleteFrom("UserStore").where("user_id", "=", namedUserId).execute();
    await ownerDb.deleteFrom("User").where("id", "=", namedUserId).execute();
    await ownerDb.deleteFrom("Store").where("tenant_id", "=", tenantId).execute();
  });
});
