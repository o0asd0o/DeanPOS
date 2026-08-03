import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { createDb } from "backend/src/db/client.ts";
import { hashPassword } from "backend/src/common/password.ts";
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
    });

    await ownerDb.deleteFrom("Session").where("user_id", "=", tempUserId).execute();
    await ownerDb.deleteFrom("UserRole").where("user_id", "=", tempUserId).execute();
    await ownerDb.deleteFrom("User").where("id", "=", tempUserId).execute();
  });
});
