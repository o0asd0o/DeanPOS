import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { createDb } from "backend/src/db/client.ts";
import { hashPassword } from "backend/src/common/password.ts";
import { withTenantScope } from "backend/src/db/client.ts";
import { createTestSeam } from "../src/test-seam.ts";

const seam = createTestSeam();
const ownerDb = createDb({ databaseUrl: process.env.DATABASE_URI! });

const tenantId = randomUUID();
const userId = randomUUID();
const email = `expiry-${randomUUID()}@sign-in.test`;
const password = "correct horse battery staple";

beforeAll(async () => {
  await ownerDb.insertInto("Tenant").values({ id: tenantId, name: "Expiry Tenant" }).execute();
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

describe("session expiry", () => {
  it("absolute expiry: a session past its expires_at is refused even though it was never idle", async () => {
    const { sessionCookie } = await seam.actors.signIn(email, password);
    const sessionId = sessionCookie!.split("=")[1]!;

    await withTenantScope(seam.db, tenantId, (db) =>
      db
        .updateTable("Session")
        .set({ expires_at: new Date(Date.now() - 1000) })
        .where("id", "=", sessionId)
        .execute(),
    );

    const client = seam.actors.withCookie(sessionCookie, seam.actors.adminOrigin);
    await expect(client.auth.me()).resolves.toStrictEqual({ authenticated: false });
  });

  it("idle expiry: a session with no recent activity is refused even though its absolute expiry is far off", async () => {
    const { sessionCookie } = await seam.actors.signIn(email, password);
    const sessionId = sessionCookie!.split("=")[1]!;

    await withTenantScope(seam.db, tenantId, (db) =>
      db
        .updateTable("Session")
        .set({ last_seen_at: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) })
        .where("id", "=", sessionId)
        .execute(),
    );

    const client = seam.actors.withCookie(sessionCookie, seam.actors.adminOrigin);
    await expect(client.auth.me()).resolves.toStrictEqual({ authenticated: false });
  });

  it("activity refreshes the idle clock", async () => {
    const { sessionCookie, client } = await seam.actors.signIn(email, password);
    const sessionId = sessionCookie!.split("=")[1]!;

    const before = await ownerDb
      .selectFrom("Session")
      .select("last_seen_at")
      .where("id", "=", sessionId)
      .executeTakeFirstOrThrow();

    await new Promise((resolve) => setTimeout(resolve, 10));
    await client.store.get({ id: randomUUID() });

    const after = await ownerDb
      .selectFrom("Session")
      .select("last_seen_at")
      .where("id", "=", sessionId)
      .executeTakeFirstOrThrow();

    expect(after.last_seen_at.getTime()).toBeGreaterThan(before.last_seen_at.getTime());
  });

  it("an unknown session id is refused, never a distinct error", async () => {
    const client = seam.actors.withCookie(
      `deanpos_session=${randomUUID()}`,
      seam.actors.adminOrigin,
    );

    const store = await client.store.get({ id: randomUUID() });
    expect(store).toBeNull();
  });
});
