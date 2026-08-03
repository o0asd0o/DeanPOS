import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { createDb } from "backend/src/db/client.ts";
import { hashPassword } from "backend/src/common/password.ts";
import { seedTenantUser } from "../src/seed-tenant-user.ts";
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
const platformAdminId = randomUUID();

beforeAll(async () => {
  await ownerDb.insertInto("Tenant").values({ id: tenantId, name: "Isolation Tenant" }).execute();
  await seedTenantUser(ownerDb, {
    id: userId,
    tenantId,
    email,
    passwordHash: await hashPassword(password),
    mustChangePassword: false,
    role: "admin",
  });
  await ownerDb
    .insertInto("PlatformAdmin")
    .values({ id: platformAdminId, email: "session-vs-platform-admin@deanpos.test" })
    .execute();
});

afterAll(async () => {
  await ownerDb.deleteFrom("Session").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("UserRole").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("User").where("id", "=", userId).execute();
  await ownerDb.deleteFrom("Tenant").where("id", "=", tenantId).execute();
  await ownerDb.deleteFrom("PlatformAdmin").where("id", "=", platformAdminId).execute();
  await ownerDb.destroy();
  await seam.db.destroy();
});

describe("a real back-office session cannot reach platform-admin provisioning", () => {
  it("is refused, never reaching provisioning, even from the admin. origin the cookie is entitled to", async () => {
    const { client } = await seam.actors.signIn(email, password);

    // The platform admin's own path still works — a procedure refusing
    // everyone would otherwise pass the refusal below for the wrong reason.
    const provisioned = await seam.actors
      .asPlatformAdmin(platformAdminId)
      .client.platformAdmin.provisionTenant({
        tenantName: "Platform Admin's Own Provision",
        adminEmail: `owner-${randomUUID()}@new-restaurant.test`,
        adminPassword: "temporary-password-1",
      });
    if (!provisioned) throw new Error("expected provisioning to succeed");

    await expectWrongTenantRefusal({
      path: "platformAdmin.provisionTenant",
      mode: "refusal",
      ownerSees: provisioned,
      otherGets: () =>
        client.platformAdmin.provisionTenant({
          tenantName: "Should Not Exist Via Back-Office Session",
          adminEmail: "nope-via-session@example.test",
          adminPassword: "irrelevant-password",
        }),
    });

    const leaked = await ownerDb
      .selectFrom("Tenant")
      .selectAll()
      .where("name", "=", "Should Not Exist Via Back-Office Session")
      .execute();
    expect(leaked).toStrictEqual([]);

    await ownerDb
      .deleteFrom("PlatformAuditLog")
      .where("tenant_id", "=", provisioned.tenantId)
      .execute();
    await ownerDb
      .deleteFrom("PaymentMethod")
      .where("tenant_id", "=", provisioned.tenantId)
      .execute();
    await ownerDb.deleteFrom("UserRole").where("tenant_id", "=", provisioned.tenantId).execute();
    await ownerDb.deleteFrom("User").where("tenant_id", "=", provisioned.tenantId).execute();
    await ownerDb.deleteFrom("Tenant").where("id", "=", provisioned.tenantId).execute();
  });
});
