import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { createDb } from "backend/src/db/client.ts";
import { hashPassword } from "backend/src/common/password.ts";
import { createTestSeam } from "../src/test-seam.ts";

// Issue 03 acceptance criterion 8, for procedures with no foreign id to
// address directly: acting as Tenant A never touches Tenant B's rows.
const seam = createTestSeam();
const ownerDb = createDb({ databaseUrl: process.env.DATABASE_URI! });

const tenantA = randomUUID();
const tenantB = randomUUID();
const userA = randomUUID();
const userB = randomUUID();
const emailA = `wrong-tenant-a-${randomUUID()}@sign-in.test`;
const emailB = `wrong-tenant-b-${randomUUID()}@sign-in.test`;
const password = "correct horse battery staple";

beforeAll(async () => {
  await ownerDb
    .insertInto("Tenant")
    .values([
      { id: tenantA, name: "Wrong-tenant A" },
      { id: tenantB, name: "Wrong-tenant B" },
    ])
    .execute();
  await ownerDb
    .insertInto("User")
    .values([
      {
        id: userA,
        tenant_id: tenantA,
        email: emailA,
        password_hash: await hashPassword(password),
        must_change_password: false,
        role: "admin",
        active: true,
      },
      {
        id: userB,
        tenant_id: tenantB,
        email: emailB,
        password_hash: await hashPassword(password),
        must_change_password: false,
        role: "admin",
        active: true,
      },
    ])
    .execute();
});

afterAll(async () => {
  await ownerDb.deleteFrom("Session").where("tenant_id", "in", [tenantA, tenantB]).execute();
  await ownerDb.deleteFrom("User").where("id", "in", [userA, userB]).execute();
  await ownerDb.deleteFrom("Tenant").where("id", "in", [tenantA, tenantB]).execute();
  await ownerDb.destroy();
  await seam.db.destroy();
});

describe("wrong-tenant probes on auth.*", () => {
  it("auth.setPassword as Tenant A's session never touches Tenant B's User row", async () => {
    const before = await ownerDb
      .selectFrom("User")
      .select("password_hash")
      .where("id", "=", userB)
      .executeTakeFirstOrThrow();

    const { client } = await seam.actors.signIn(emailA, password);
    await client.auth.setPassword({ newPassword: "a's new password" });

    const rowA = await ownerDb
      .selectFrom("User")
      .selectAll()
      .where("id", "=", userA)
      .executeTakeFirstOrThrow();
    const rowB = await ownerDb
      .selectFrom("User")
      .selectAll()
      .where("id", "=", userB)
      .executeTakeFirstOrThrow();

    // A's hash changed to the new password; B's is byte-for-byte unchanged
    // — not merely "still a scrypt-shaped string", which a fresh hash of
    // the same plaintext would also be, salt notwithstanding.
    expect(rowA.password_hash).not.toBe(before.password_hash);
    expect(rowB.password_hash).toBe(before.password_hash);
  });

  it("auth.signOut as Tenant A's session never revokes Tenant B's Session row", async () => {
    const sessionB = await seam.actors.signIn(emailB, password);
    const sessionA = await seam.actors.signIn(emailA, password);

    await sessionA.client.auth.signOut();

    const rowB = await ownerDb
      .selectFrom("Session")
      .selectAll()
      .where("id", "=", sessionB.sessionCookie!.split("=")[1]!)
      .executeTakeFirstOrThrow();
    expect(rowB.revoked_at).toBeNull();
  });
});
