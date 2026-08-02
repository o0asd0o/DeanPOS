import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { createDb } from "backend/src/db/client.ts";
import { hashPassword } from "backend/src/common/password.ts";
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
  await ownerDb
    .insertInto("User")
    .values({
      id: userId,
      tenant_id: tenantId,
      email,
      password_hash: await hashPassword(password),
      must_change_password: false,
      role: "admin",
      active: true,
    })
    .execute();
});

afterAll(async () => {
  await ownerDb.deleteFrom("Session").where("tenant_id", "=", tenantId).execute();
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
    });
  });

  it("stays reachable even while mustChangePassword is true", async () => {
    const tempUserId = randomUUID();
    const tempEmail = `me-temp-${randomUUID()}@sign-in.test`;
    await ownerDb
      .insertInto("User")
      .values({
        id: tempUserId,
        tenant_id: tenantId,
        email: tempEmail,
        password_hash: await hashPassword("temp-password-1"),
        must_change_password: true,
        role: "cashier",
        active: true,
      })
      .execute();

    const { client } = await seam.actors.signIn(tempEmail, "temp-password-1");
    await expect(client.auth.me()).resolves.toStrictEqual({
      authenticated: true,
      mustChangePassword: true,
    });

    await ownerDb.deleteFrom("Session").where("user_id", "=", tempUserId).execute();
    await ownerDb.deleteFrom("User").where("id", "=", tempUserId).execute();
  });
});
