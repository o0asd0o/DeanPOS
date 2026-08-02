import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { createDb } from "backend/src/db/client.ts";
import { hashPassword } from "backend/src/common/password.ts";
import { createClient } from "contract/src/index.ts";
import { ENV_KEYS } from "../src/env.ts";
import { seedTenantUser } from "../src/seed-tenant-user.ts";
import { createTestSeam } from "../src/test-seam.ts";

const seam = createTestSeam();
const ownerDb = createDb({ databaseUrl: process.env.DATABASE_URI! });
const appDomain = process.env[ENV_KEYS.appDomain]!;

const tenantId = randomUUID();
const userId = randomUUID();
const email = `origin-gate-${randomUUID()}@sign-in.test`;
const password = "correct horse battery staple";

let sessionCookie: string;

beforeAll(async () => {
  await ownerDb.insertInto("Tenant").values({ id: tenantId, name: "Origin Gate Tenant" }).execute();
  await seedTenantUser(ownerDb, {
    id: userId,
    tenantId,
    email,
    passwordHash: await hashPassword(password),
    mustChangePassword: false,
    role: "admin",
  });

  const { sessionCookie: cookie } = await seam.actors.signIn(email, password);
  sessionCookie = cookie!;
});

afterAll(async () => {
  await ownerDb.deleteFrom("Session").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("UserRole").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("User").where("id", "=", userId).execute();
  await ownerDb.deleteFrom("Tenant").where("id", "=", tenantId).execute();
  await ownerDb.destroy();
  await seam.db.destroy();
});

describe("the back-office Origin gate", () => {
  it("refuses a valid session cookie presented from the pos. origin", async () => {
    const client = seam.actors.withCookie(sessionCookie, `https://pos.${appDomain}`);

    await expect(client.store.get({ id: randomUUID() })).rejects.toThrow();
  });

  it("refuses a valid session cookie presented from a foreign origin", async () => {
    const client = seam.actors.withCookie(sessionCookie, "https://attacker.example.com");

    await expect(client.store.get({ id: randomUUID() })).rejects.toThrow();
  });

  it("refuses a valid session cookie presented with no Origin header at all", async () => {
    const client = seam.actors.withCookie(sessionCookie, null);

    await expect(client.store.get({ id: randomUUID() })).rejects.toThrow();
  });

  it("accepts the valid session cookie from the admin. origin", async () => {
    const client = seam.actors.withCookie(sessionCookie, seam.actors.adminOrigin);

    await expect(client.store.get({ id: randomUUID() })).resolves.toBeNull();
  });

  it("a request with no cookie at all is not gated on Origin — it is simply unauthenticated", async () => {
    const client = seam.actors.withCookie(null, null);

    const store = await client.store.get({ id: randomUUID() });
    expect(store).toBeNull();
  });

  // Issue 09's device token rides in `Authorization`, never the cookie. A
  // terminal that incidentally carries a stray admin-domain session cookie
  // must not be refused by this app's cookie-CSRF gate for a credential it
  // never intended to use.
  it("a device-token request carrying an incidental session cookie from the pos. origin is not refused by the Origin gate", async () => {
    const client = createClient({
      url: `https://api.${appDomain}/rpc`,
      fetch: async (request) => {
        request.headers.set("Origin", `https://pos.${appDomain}`);
        request.headers.set("Cookie", sessionCookie);
        request.headers.set("Authorization", "Bearer irrelevant-device-token");
        return seam.app.request(request);
      },
    });

    const store = await client.store.get({ id: randomUUID() });
    expect(store).toBeNull(); // reached the procedure unauthenticated, not refused with FORBIDDEN
  });
});
