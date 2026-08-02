import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { createDb, withTenantScope } from "backend/src/db/client.ts";
import { createTestSeam } from "../src/test-seam.ts";
import { expectWrongTenantRefusal } from "../src/wrong-tenant-probe.ts";

const seam = createTestSeam();
const ownerDb = createDb({ databaseUrl: process.env.DATABASE_URI! });

const platformAdminId = randomUUID();
const existingTenantId = randomUUID();
const provisionedTenantIds: string[] = [];

beforeAll(async () => {
  await ownerDb
    .insertInto("PlatformAdmin")
    .values({ id: platformAdminId, email: "platform-admin@deanpos.test" })
    .execute();
  await ownerDb
    .insertInto("Tenant")
    .values({ id: existingTenantId, name: "Existing Tenant" })
    .execute();
});

afterAll(async () => {
  if (provisionedTenantIds.length > 0) {
    await ownerDb
      .deleteFrom("PlatformAuditLog")
      .where("tenant_id", "in", provisionedTenantIds)
      .execute();
    await ownerDb.deleteFrom("User").where("tenant_id", "in", provisionedTenantIds).execute();
    await ownerDb.deleteFrom("Tenant").where("id", "in", provisionedTenantIds).execute();
  }
  await ownerDb.deleteFrom("Tenant").where("id", "=", existingTenantId).execute();
  await ownerDb.deleteFrom("PlatformAdmin").where("id", "=", platformAdminId).execute();
  await ownerDb.destroy();
  await seam.db.destroy();
});

async function provisionAsPlatformAdmin(
  overrides: Partial<{
    tenantName: string;
    adminEmail: string;
    adminPassword: string;
  }> = {},
) {
  const result = await seam.actors
    .asPlatformAdmin(platformAdminId)
    .client.platformAdmin.provisionTenant({
      tenantName: "New Restaurant",
      adminEmail: `owner-${randomUUID()}@new-restaurant.test`,
      adminPassword: "temporary-password-1",
      ...overrides,
    });
  if (!result) throw new Error("expected provisioning to succeed");
  provisionedTenantIds.push(result.tenantId);
  return result;
}

describe("platformAdmin.provisionTenant", () => {
  it("creates a Tenant and exactly one admin User with a temporary, must-change password", async () => {
    const result = await provisionAsPlatformAdmin({ tenantName: "New Restaurant" });

    const tenant = await ownerDb
      .selectFrom("Tenant")
      .selectAll()
      .where("id", "=", result.tenantId)
      .executeTakeFirst();
    expect(tenant?.name).toBe("New Restaurant");

    const users = await ownerDb
      .selectFrom("User")
      .selectAll()
      .where("tenant_id", "=", result.tenantId)
      .execute();
    expect(users).toHaveLength(1);
    expect(users[0]?.id).toBe(result.userId);
    expect(users[0]?.role).toBe("admin");
    expect(users[0]?.must_change_password).toBe(true);
    expect(users[0]?.password_hash).not.toBe("temporary-password-1");
    expect(users[0]?.password_hash).toMatch(/^\$scrypt\$/);
  });

  it("writes an audit row naming the actor, the action, and the Tenant", async () => {
    const result = await provisionAsPlatformAdmin({ tenantName: "Audited Restaurant" });

    const rows = await ownerDb
      .selectFrom("PlatformAuditLog")
      .selectAll()
      .where("tenant_id", "=", result.tenantId)
      .execute();

    expect(rows).toHaveLength(1);
    expect(rows[0]?.platform_admin_id).toBe(platformAdminId);
    expect(rows[0]?.action).toBe("provision_tenant");
  });

  it("the wrong-tenant probe: a tenant-scoped principal is refused, never reaching provisioning", async () => {
    await expectWrongTenantRefusal(
      () =>
        seam.actors.asTenant(existingTenantId).client.platformAdmin.provisionTenant({
          tenantName: "Should Not Exist",
          adminEmail: "nope@example.test",
          adminPassword: "irrelevant-password",
        }),
      (result) => result === null,
    );

    const leaked = await ownerDb
      .selectFrom("Tenant")
      .selectAll()
      .where("name", "=", "Should Not Exist")
      .execute();
    expect(leaked).toStrictEqual([]);
  });

  it("an unauthenticated caller is refused, never reaching provisioning", async () => {
    await expectWrongTenantRefusal(
      () =>
        seam.actors.asUnauthenticated().client.platformAdmin.provisionTenant({
          tenantName: "Should Also Not Exist",
          adminEmail: "still-nope@example.test",
          adminPassword: "irrelevant-password",
        }),
      (result) => result === null,
    );
  });

  it("is isolated on arrival: an existing Tenant cannot read the new Tenant or its admin User", async () => {
    const result = await provisionAsPlatformAdmin({ tenantName: "Isolated Restaurant" });

    const tenantRow = await withTenantScope(seam.db, existingTenantId, (db) =>
      db.selectFrom("Tenant").selectAll().where("id", "=", result.tenantId).executeTakeFirst(),
    );
    expect(tenantRow).toBeUndefined();

    const userRow = await withTenantScope(seam.db, existingTenantId, (db) =>
      db.selectFrom("User").selectAll().where("id", "=", result.userId).executeTakeFirst(),
    );
    expect(userRow).toBeUndefined();
  });

  it("RLS, not the application layer, blocks a tenant-scoped connection from minting another Tenant", async () => {
    await expect(
      withTenantScope(seam.db, existingTenantId, (db) =>
        db.insertInto("Tenant").values({ id: randomUUID(), name: "Forged Tenant" }).execute(),
      ),
    ).rejects.toThrow(/permission denied|row-level security/i);
  });
});
