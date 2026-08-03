import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { createDb, withTenantScope } from "backend/src/db/client.ts";
import { getRoleAsOf } from "backend/src/access/db-operations/queries/get-role-as-of.query.ts";
import { handler as provisionTenantHandler } from "backend/src/platform-admin/handlers/provision-tenant.ts";
import { createClient } from "contract/src/index.ts";
import { ENV_KEYS } from "../src/env.ts";
import { createTestSeam } from "../src/test-seam.ts";
import { expectWrongTenantRefusal } from "../src/wrong-tenant-probe.ts";

const seam = createTestSeam();
const ownerDb = createDb({ databaseUrl: process.env.DATABASE_URI! });
const appDomain = process.env[ENV_KEYS.appDomain]!;

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
    // Issue 08: provisioning seeds `cash` for every Tenant it creates.
    await ownerDb
      .deleteFrom("PaymentMethod")
      .where("tenant_id", "in", provisionedTenantIds)
      .execute();
    await ownerDb.deleteFrom("UserRole").where("tenant_id", "in", provisionedTenantIds).execute();
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

  // Issue 08 acceptance criteria: a freshly provisioned Tenant has exactly
  // one PaymentMethod, `cash`, and no audit row for it (provisioning writes
  // no actor).
  it("seeds exactly one cash PaymentMethod, with no audit row", async () => {
    const result = await provisionAsPlatformAdmin({ tenantName: "Cash Seeded Restaurant" });

    const methods = await ownerDb
      .selectFrom("PaymentMethod")
      .selectAll()
      .where("tenant_id", "=", result.tenantId)
      .execute();
    expect(methods).toHaveLength(1);
    expect(methods[0]?.name).toBe("Cash");
    expect(methods[0]?.kind).toBe("cash");
    expect(methods[0]?.active).toBe(true);

    const audits = await ownerDb
      .selectFrom("PaymentMethodAudit")
      .selectAll()
      .where("tenant_id", "=", result.tenantId)
      .execute();
    expect(audits).toHaveLength(0);
  });

  // Issue 04, round 1 finding 1: the User and its opening UserRole row are
  // written in the same transaction, so the role is readable immediately —
  // issue 12's offline-Override re-verification depends on this.
  it("the new admin's role is readable through getRoleAsOf immediately", async () => {
    const result = await provisionAsPlatformAdmin({ tenantName: "Role Readable Restaurant" });

    const role = await withTenantScope(seam.db, result.tenantId, (db) =>
      getRoleAsOf(db, result.userId, new Date()),
    );
    expect(role?.role).toBe("admin");
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

  it("wrong-tenant probe [platformAdmin.provisionTenant]: a tenant-scoped principal is refused, never reaching provisioning", async () => {
    const provisioned = await provisionAsPlatformAdmin({ tenantName: "Owner's Own Provision" });

    await expectWrongTenantRefusal({
      path: "platformAdmin.provisionTenant",
      mode: "refusal",
      ownerSees: provisioned,
      otherGets: () =>
        seam.actors.asTenant(existingTenantId).client.platformAdmin.provisionTenant({
          tenantName: "Should Not Exist",
          adminEmail: "nope@example.test",
          adminPassword: "irrelevant-password",
        }),
    });

    const leaked = await ownerDb
      .selectFrom("Tenant")
      .selectAll()
      .where("name", "=", "Should Not Exist")
      .execute();
    expect(leaked).toStrictEqual([]);
  });

  it("an unauthenticated caller is refused, never reaching provisioning", async () => {
    const provisioned = await provisionAsPlatformAdmin({ tenantName: "Owner's Own Provision 2" });

    await expectWrongTenantRefusal({
      path: "platformAdmin.provisionTenant",
      mode: "refusal",
      ownerSees: provisioned,
      otherGets: () =>
        seam.actors.asUnauthenticated().client.platformAdmin.provisionTenant({
          tenantName: "Should Also Not Exist",
          adminEmail: "still-nope@example.test",
          adminPassword: "irrelevant-password",
        }),
    });
  });

  it("refuses a Ctx that somehow carries both a tenant and a platform-admin principal", async () => {
    const mixedCtx = seam.buildMixedPrincipalCtx(existingTenantId, platformAdminId);

    const result = await provisionTenantHandler({
      ctx: mixedCtx,
      input: {
        tenantName: "Should Never Exist",
        adminEmail: "mixed-principal@example.test",
        adminPassword: "irrelevant-password",
      },
    });

    expect(result).toBeNull();
    const leaked = await ownerDb
      .selectFrom("Tenant")
      .selectAll()
      .where("name", "=", "Should Never Exist")
      .execute();
    expect(leaked).toStrictEqual([]);
  });

  it("the admin origin grants nothing by itself: a tenant-scoped principal calling from the admin origin is still refused", async () => {
    const tenantActor = seam.actors.asTenant(existingTenantId);
    const fromAdminOrigin = createClient({
      url: `https://api.${appDomain}/rpc`,
      fetch: async (request, init) => {
        const withAdminOrigin = new Request(request, {
          headers: new Headers({
            ...Object.fromEntries(request.headers),
            Origin: `https://admin.${appDomain}`,
          }),
        });
        return tenantActor.app.request(withAdminOrigin, init);
      },
    });

    const provisioned = await provisionAsPlatformAdmin({ tenantName: "Owner's Own Provision 3" });

    await expectWrongTenantRefusal({
      path: "platformAdmin.provisionTenant",
      mode: "refusal",
      ownerSees: provisioned,
      otherGets: () =>
        fromAdminOrigin.platformAdmin.provisionTenant({
          tenantName: "Should Not Exist From Admin Origin",
          adminEmail: "nope-admin-origin@example.test",
          adminPassword: "irrelevant-password",
        }),
    });
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
