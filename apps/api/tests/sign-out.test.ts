import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { createDb } from "backend/src/db/client.ts";
import { hashPassword } from "backend/src/common/password.ts";
import { seedTenantUser } from "../src/seed-tenant-user.ts";
import { createTestSeam } from "../src/test-seam.ts";

const seam = createTestSeam();
const ownerDb = createDb({ databaseUrl: process.env.DATABASE_URI! });

const tenantId = randomUUID();
const userId = randomUUID();
const email = `sign-out-${randomUUID()}@sign-in.test`;
const password = "correct horse battery staple";

beforeAll(async () => {
  await ownerDb.insertInto("Tenant").values({ id: tenantId, name: "Sign-out Tenant" }).execute();
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

describe("auth.signOut", () => {
  it("revokes the session row server-side", async () => {
    const { sessionCookie, client } = await seam.actors.signIn(email, password);

    await client.auth.signOut();

    const row = await ownerDb
      .selectFrom("Session")
      .selectAll()
      .where("id", "=", sessionCookie!.split("=")[1]!)
      .executeTakeFirstOrThrow();
    expect(row.revoked_at).not.toBeNull();
  });

  it("the cookie alone cannot resurrect a revoked session", async () => {
    const { sessionCookie, client } = await seam.actors.signIn(email, password);
    await client.auth.signOut();

    // Replays the original cookie: proves context construction itself
    // honours `revoked_at`, not merely that the row was written.
    await expect(client.auth.me()).resolves.toStrictEqual({ authenticated: false });

    const row = await ownerDb
      .selectFrom("Session")
      .selectAll()
      .where("id", "=", sessionCookie!.split("=")[1]!)
      .executeTakeFirstOrThrow();
    expect(row.revoked_at).not.toBeNull();
  });

  it("sets an expired cookie so the browser drops it too", async () => {
    const rawResponse = await seam.app.request(
      new Request(`https://api.deanpos.test/rpc/auth/signOut`, {
        method: "POST",
        headers: { Origin: seam.actors.adminOrigin, "Content-Type": "application/json" },
        body: "{}",
      }),
    );

    expect(rawResponse.headers.get("Set-Cookie")).toMatch(/Max-Age=0/);
  });
});
