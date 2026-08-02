import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { createDb } from "backend/src/db/client.ts";
import { hashPassword } from "backend/src/common/password.ts";
import { createTestSeam } from "../src/test-seam.ts";
import { expectWrongTenantRefusal } from "../src/wrong-tenant-probe.ts";

// Closes issue 02's carried-over half of criterion 6 (its `## Comments`):
// a real back-office session, from the admin. origin it is entitled to,
// still cannot reach platform-admin provisioning.
const seam = createTestSeam();
const ownerDb = createDb({ databaseUrl: process.env.DATABASE_URI! });

const tenantId = randomUUID();
const userId = randomUUID();
const email = `backoffice-vs-platform-${randomUUID()}@sign-in.test`;
const password = "correct horse battery staple";

beforeAll(async () => {
  await ownerDb.insertInto("Tenant").values({ id: tenantId, name: "Isolation Tenant" }).execute();
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

describe("a real back-office session cannot reach platform-admin provisioning", () => {
  it("is refused, never reaching provisioning, even from the admin. origin the cookie is entitled to", async () => {
    const { client } = await seam.actors.signIn(email, password);

    await expectWrongTenantRefusal(
      () =>
        client.platformAdmin.provisionTenant({
          tenantName: "Should Not Exist Via Back-Office Session",
          adminEmail: "nope-via-session@example.test",
          adminPassword: "irrelevant-password",
        }),
      (result) => result === null,
    );

    const leaked = await ownerDb
      .selectFrom("Tenant")
      .selectAll()
      .where("name", "=", "Should Not Exist Via Back-Office Session")
      .execute();
    expect(leaked).toStrictEqual([]);
  });
});
