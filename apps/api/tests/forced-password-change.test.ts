import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { createDb } from "backend/src/db/client.ts";
import { hashPassword, verifyPassword } from "backend/src/common/password.ts";
import { createTestSeam } from "../src/test-seam.ts";

const seam = createTestSeam();
const ownerDb = createDb({ databaseUrl: process.env.DATABASE_URI! });

const tenantId = randomUUID();
const userId = randomUUID();
const email = `must-change-${randomUUID()}@sign-in.test`;
const temporaryPassword = "temporary-password-1";

beforeAll(async () => {
  await ownerDb.insertInto("Tenant").values({ id: tenantId, name: "Must Change Tenant" }).execute();
  await ownerDb
    .insertInto("User")
    .values({
      id: userId,
      tenant_id: tenantId,
      email,
      password_hash: await hashPassword(temporaryPassword),
      must_change_password: true,
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

describe("the forced-password-change gate", () => {
  it("sign-in reports mustChangePassword: true for a temporary password", async () => {
    const { result } = await seam.actors.signIn(email, temporaryPassword);
    expect(result).toStrictEqual({ ok: true, mustChangePassword: true });
  });

  it("a User holding a temporary password is refused on an ordinary procedure", async () => {
    const { client } = await seam.actors.signIn(email, temporaryPassword);

    await expect(client.store.get({ id: randomUUID() })).rejects.toThrow();
  });

  it("the same User may sign in again while its stuck session cookie rides along", async () => {
    const { sessionCookie } = await seam.actors.signIn(email, temporaryPassword);
    const stuck = seam.actors.withCookie(sessionCookie, seam.actors.adminOrigin);

    await expect(stuck.auth.signIn({ email, password: temporaryPassword })).resolves.toStrictEqual({
      ok: true,
      mustChangePassword: true,
    });
  });

  it("the same User may still reach auth.setPassword", async () => {
    const { client } = await seam.actors.signIn(email, temporaryPassword);

    const result = await client.auth.setPassword({ newPassword: "a brand new password" });
    expect(result).toStrictEqual({ ok: true });

    const row = await ownerDb
      .selectFrom("User")
      .selectAll()
      .where("id", "=", userId)
      .executeTakeFirstOrThrow();
    expect(row.must_change_password).toBe(false);
    expect(await verifyPassword("a brand new password", row.password_hash)).toBe(true);
    expect(await verifyPassword(temporaryPassword, row.password_hash)).toBe(false);
  });

  it("the same User may still reach auth.signOut", async () => {
    const { client } = await seam.actors.signIn(email, temporaryPassword);

    await expect(client.auth.signOut()).resolves.toStrictEqual({ ok: true });
  });

  it("after setting a new password, an ordinary procedure succeeds", async () => {
    await ownerDb
      .updateTable("User")
      .set({ must_change_password: true, password_hash: await hashPassword(temporaryPassword) })
      .where("id", "=", userId)
      .execute();

    const { client } = await seam.actors.signIn(email, temporaryPassword);
    await client.auth.setPassword({ newPassword: "another new password" });

    await expect(client.store.get({ id: randomUUID() })).resolves.toBeNull();
  });

  it("an ordinary session (mustChangePassword: false) is refused on auth.setPassword", async () => {
    const ordinaryEmail = `ordinary-${randomUUID()}@sign-in.test`;
    const ordinaryPassword = "an ordinary password";
    const ordinaryUserId = randomUUID();
    await ownerDb
      .insertInto("User")
      .values({
        id: ordinaryUserId,
        tenant_id: tenantId,
        email: ordinaryEmail,
        password_hash: await hashPassword(ordinaryPassword),
        must_change_password: false,
        role: "admin",
        active: true,
      })
      .execute();

    const { client } = await seam.actors.signIn(ordinaryEmail, ordinaryPassword);
    const result = await client.auth.setPassword({ newPassword: "a stolen-session password" });
    expect(result).toStrictEqual({ ok: false });

    const row = await ownerDb
      .selectFrom("User")
      .selectAll()
      .where("id", "=", ordinaryUserId)
      .executeTakeFirstOrThrow();
    expect(await verifyPassword(ordinaryPassword, row.password_hash)).toBe(true);

    await ownerDb.deleteFrom("Session").where("user_id", "=", ordinaryUserId).execute();
    await ownerDb.deleteFrom("User").where("id", "=", ordinaryUserId).execute();
  });
});
