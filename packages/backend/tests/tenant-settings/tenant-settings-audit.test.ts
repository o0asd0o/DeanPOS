import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { hashPassword } from "../../src/common/password.ts";
import { createDb, type DatabaseInstance, withTenantScope } from "../../src/db/client.ts";

// Issue 07, record 046 §3: TenantSettingsAudit is append-only, structurally,
// following issue 04's UserRole/UserStore pattern exactly.
const ownerDb: DatabaseInstance = createDb({ databaseUrl: process.env.DATABASE_URI! });
const appDb: DatabaseInstance = createDb({ databaseUrl: process.env.APP_DATABASE_URI! });

const tenantA = randomUUID();
const tenantB = randomUUID();
const userA = randomUUID();
const userB = randomUUID();

beforeAll(async () => {
  await ownerDb
    .insertInto("Tenant")
    .values([
      { id: tenantA, name: "Settings Audit Tenant A" },
      { id: tenantB, name: "Settings Audit Tenant B" },
    ])
    .execute();
  const passwordHash = await hashPassword("irrelevant");
  await ownerDb
    .insertInto("User")
    .values([
      {
        id: userA,
        tenant_id: tenantA,
        email: `settings-audit-a-${randomUUID()}@settings.test`,
        password_hash: passwordHash,
        role: "admin",
      },
      {
        id: userB,
        tenant_id: tenantB,
        email: `settings-audit-b-${randomUUID()}@settings.test`,
        password_hash: passwordHash,
        role: "admin",
      },
    ])
    .execute();
});

afterAll(async () => {
  await ownerDb
    .deleteFrom("TenantSettingsAudit")
    .where("tenant_id", "in", [tenantA, tenantB])
    .execute();
  await ownerDb.deleteFrom("User").where("tenant_id", "in", [tenantA, tenantB]).execute();
  await ownerDb.deleteFrom("Tenant").where("id", "in", [tenantA, tenantB]).execute();
  await ownerDb.destroy();
  await appDb.destroy();
});

describe("TenantSettingsAudit: append-only, structurally", () => {
  it("deanpos_app can INSERT a row", async () => {
    await withTenantScope(appDb, tenantA, (db) =>
      db
        .insertInto("TenantSettingsAudit")
        .values({
          id: randomUUID(),
          tenant_id: tenantA,
          actor_user_id: userA,
          setting: "vatEnabled",
          old_value: "false",
          new_value: "true",
        })
        .execute(),
    );

    const rows = await withTenantScope(appDb, tenantA, (db) =>
      db.selectFrom("TenantSettingsAudit").selectAll().where("actor_user_id", "=", userA).execute(),
    );
    expect(rows).toHaveLength(1);
  });

  it("an UPDATE against TenantSettingsAudit is refused, not merely discouraged", async () => {
    await expect(
      withTenantScope(appDb, tenantA, (db) =>
        db
          .updateTable("TenantSettingsAudit")
          .set({ new_value: "hijacked" })
          .where("actor_user_id", "=", userA)
          .execute(),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("a DELETE against TenantSettingsAudit is refused, not merely discouraged", async () => {
    await expect(
      withTenantScope(appDb, tenantA, (db) =>
        db.deleteFrom("TenantSettingsAudit").where("actor_user_id", "=", userA).execute(),
      ),
    ).rejects.toThrow(/permission denied/);
  });
});

// The composite-FK trap issue 04 found on a plain user_id FK: checked
// independently, tenant_id and actor_user_id would let a Tenant A
// transaction attach an audit row to a Tenant B User.
describe("TenantSettingsAudit: composite FK rejects a mismatched tenant", () => {
  it("TenantSettingsAudit(tenantA, actor=userB) is rejected", async () => {
    await expect(
      withTenantScope(appDb, tenantA, (db) =>
        db
          .insertInto("TenantSettingsAudit")
          .values({
            id: randomUUID(),
            tenant_id: tenantA,
            actor_user_id: userB,
            setting: "timezone",
            old_value: "Asia/Manila",
            new_value: "UTC",
          })
          .execute(),
      ),
    ).rejects.toThrow(/violates foreign key constraint/);
  });
});

describe("TenantSettingsAudit: RLS, not application filtering", () => {
  it("a row inserted as Tenant A is invisible to a Tenant B connection", async () => {
    const rowId = randomUUID();
    await withTenantScope(appDb, tenantA, (db) =>
      db
        .insertInto("TenantSettingsAudit")
        .values({
          id: rowId,
          tenant_id: tenantA,
          actor_user_id: userA,
          setting: "vatRatePercent",
          old_value: "12",
          new_value: "15",
        })
        .execute(),
    );

    const asB = await withTenantScope(appDb, tenantB, (db) =>
      db.selectFrom("TenantSettingsAudit").selectAll().where("id", "=", rowId).executeTakeFirst(),
    );
    expect(asB).toBeUndefined();

    const asA = await withTenantScope(appDb, tenantA, (db) =>
      db.selectFrom("TenantSettingsAudit").selectAll().where("id", "=", rowId).executeTakeFirst(),
    );
    expect(asA?.id).toBe(rowId);
  });
});
