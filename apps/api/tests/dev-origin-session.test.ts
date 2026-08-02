import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { createDb } from "backend/src/db/client.ts";
import { hashPassword } from "backend/src/common/password.ts";
import { createTestSeam } from "../src/test-seam.ts";

const devOrigin = "http://localhost:6004";
const seam = createTestSeam({ devOrigins: [devOrigin] });
const ownerDb = createDb({ databaseUrl: process.env.DATABASE_URI! });

const tenantId = randomUUID();
const userId = randomUUID();
const email = `dev-origin-${randomUUID()}@sign-in.test`;
const password = "correct horse battery staple";

let sessionCookie: string;

beforeAll(async () => {
  await ownerDb.insertInto("Tenant").values({ id: tenantId, name: "Dev Origin Tenant" }).execute();
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

  const { sessionCookie: cookie } = await seam.actors.signIn(email, password);
  sessionCookie = cookie!;
});

afterAll(async () => {
  await ownerDb.deleteFrom("Session").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("User").where("id", "=", userId).execute();
  await ownerDb.deleteFrom("Tenant").where("id", "=", tenantId).execute();
  await ownerDb.destroy();
  await seam.db.destroy();
});

// Both halves of the localhost dev path: a browser on http://localhost drops
// a `Secure`/`Domain=`-scoped cookie outright, and the Origin gate then has to
// admit the origin that carries it back.
describe("a session on the localhost dev origins", () => {
  it("sets a cookie a plain-http localhost browser will keep", async () => {
    const { setCookie } = await seam.actors.signIn(email, password);

    expect(setCookie).toMatch(/^deanpos_session=[^;]+/);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(setCookie).not.toMatch(/Secure/i);
    expect(setCookie).not.toMatch(/Domain=/i);
  });

  it("accepts that cookie from a dev origin, and still refuses a foreign one", async () => {
    await expect(
      seam.actors.withCookie(sessionCookie, devOrigin).store.get({ id: randomUUID() }),
    ).resolves.toBeNull();

    await expect(
      seam.actors
        .withCookie(sessionCookie, "https://attacker.example.com")
        .store.get({ id: randomUUID() }),
    ).rejects.toThrow();
  });
});
