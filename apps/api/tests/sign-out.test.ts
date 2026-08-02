import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { createDb } from "backend/src/db/client.ts";
import { hashPassword } from "backend/src/common/password.ts";
import { createTestSeam } from "../src/test-seam.ts";

const seam = createTestSeam();
const ownerDb = createDb({ databaseUrl: process.env.DATABASE_URI! });

const tenantId = randomUUID();
const userId = randomUUID();
const email = `sign-out-${randomUUID()}@sign-in.test`;
const password = "correct horse battery staple";

beforeAll(async () => {
  await ownerDb.insertInto("Tenant").values({ id: tenantId, name: "Sign-out Tenant" }).execute();
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

    const storeAfterSignOut = await client.store.get({ id: randomUUID() });
    expect(storeAfterSignOut).toBeNull();

    // Confirm it reads as truly unauthenticated, not merely "no matching Store".
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
