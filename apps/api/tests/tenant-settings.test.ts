import { randomUUID } from "node:crypto";

import { createDb } from "backend/src/db/client.ts";
import { hashPassword } from "backend/src/common/password.ts";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { createTestSeam } from "../src/test-seam.ts";

// Issue 07: the five Tenant settings, admin-only, audited per changed
// setting. Criterion 1 is asserted through platformAdmin.provisionTenant,
// not a hand-seeded row (issue's own "Criterion 1" note).
const seam = createTestSeam();
const ownerDb = createDb({ databaseUrl: process.env.DATABASE_URI! });

const tenantA = randomUUID();
const tenantB = randomUUID();
const adminA = randomUUID();
const managerA = randomUUID();
const cashierA = randomUUID();
const adminB = randomUUID();

beforeAll(async () => {
  await ownerDb
    .insertInto("Tenant")
    .values([
      { id: tenantA, name: "Settings Tenant A" },
      { id: tenantB, name: "Settings Tenant B" },
    ])
    .execute();

  const passwordHash = await hashPassword("irrelevant");
  await ownerDb
    .insertInto("User")
    .values([
      {
        id: adminA,
        tenant_id: tenantA,
        email: `settings-admin-a-${randomUUID()}@settings.test`,
        password_hash: passwordHash,
        role: "admin",
      },
      {
        id: managerA,
        tenant_id: tenantA,
        email: `settings-manager-a-${randomUUID()}@settings.test`,
        password_hash: passwordHash,
        role: "manager",
      },
      {
        id: cashierA,
        tenant_id: tenantA,
        email: `settings-cashier-a-${randomUUID()}@settings.test`,
        password_hash: passwordHash,
        role: "cashier",
      },
      {
        id: adminB,
        tenant_id: tenantB,
        email: `settings-admin-b-${randomUUID()}@settings.test`,
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
  await seam.db.destroy();
});

describe("a freshly provisioned Tenant", () => {
  it("has every default: VAT off, 12% rate, zero tolerance, zero override threshold, Asia/Manila", async () => {
    const platformAdminId = randomUUID();
    await ownerDb
      .insertInto("PlatformAdmin")
      .values({ id: platformAdminId, email: `settings-pa-${randomUUID()}@settings.test` })
      .execute();

    const provisioned = await seam.actors
      .asPlatformAdmin(platformAdminId)
      .client.platformAdmin.provisionTenant({
        tenantName: "Freshly Provisioned",
        adminEmail: `fresh-admin-${randomUUID()}@settings.test`,
        adminPassword: "temporary-password-1",
      });
    if (!provisioned) throw new Error("expected provisioning to succeed");

    const settings = await seam.actors
      .asTenant(provisioned.tenantId, { userId: provisioned.userId, role: "admin" })
      .client.settings.get();

    expect(settings).toStrictEqual({
      timezone: "Asia/Manila",
      vatEnabled: false,
      vatRatePercent: 12,
      varianceToleranceCentavos: 0,
      cashMovementOverrideThresholdCentavos: 0,
    });

    await ownerDb
      .deleteFrom("PlatformAuditLog")
      .where("tenant_id", "=", provisioned.tenantId)
      .execute();
    await ownerDb.deleteFrom("UserRole").where("tenant_id", "=", provisioned.tenantId).execute();
    await ownerDb.deleteFrom("User").where("tenant_id", "=", provisioned.tenantId).execute();
    await ownerDb.deleteFrom("Tenant").where("id", "=", provisioned.tenantId).execute();
    await ownerDb.deleteFrom("PlatformAdmin").where("id", "=", platformAdminId).execute();
  });
});

describe("settings.get", () => {
  it("an admin reads every setting", async () => {
    const settings = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.settings.get();

    expect(settings?.timezone).toBe("Asia/Manila");
    expect(settings?.vatEnabled).toBe(false);
  });

  it("a manager is refused, server-side", async () => {
    const result = await seam.actors
      .asTenant(tenantA, { userId: managerA, role: "manager" })
      .client.settings.get();
    expect(result).toBeNull();
  });

  it("a cashier is refused, server-side", async () => {
    const result = await seam.actors
      .asTenant(tenantA, { userId: cashierA, role: "cashier" })
      .client.settings.get();
    expect(result).toBeNull();
  });

  it("the wrong-tenant probe: settings.get has no addressable id, so RLS alone must confine a read to the caller's own Tenant — Tenant B changes its own settings first, then Tenant A's read is proven not to see them", async () => {
    // Change B away from the shared defaults on all five fields, through
    // B's own application path, so the probe below cannot pass by
    // coincidence on any single field.
    const changedAsB = await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.settings.update({
        timezone: "Asia/Tokyo",
        vatEnabled: true,
        vatRatePercent: 30,
        varianceToleranceCentavos: 7,
        cashMovementOverrideThresholdCentavos: 7,
      });
    expect(changedAsB).toStrictEqual({
      timezone: "Asia/Tokyo",
      vatEnabled: true,
      vatRatePercent: 30,
      varianceToleranceCentavos: 7,
      cashMovementOverrideThresholdCentavos: 7,
    });

    const asA = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.settings.get();
    expect(asA).toStrictEqual({
      timezone: "Asia/Manila",
      vatEnabled: false,
      vatRatePercent: 12,
      varianceToleranceCentavos: 0,
      cashMovementOverrideThresholdCentavos: 0,
    });

    // Restore B.
    await seam.actors.asTenant(tenantB, { userId: adminB, role: "admin" }).client.settings.update({
      timezone: "Asia/Manila",
      vatEnabled: false,
      vatRatePercent: 12,
      varianceToleranceCentavos: 0,
      cashMovementOverrideThresholdCentavos: 0,
    });
    await ownerDb.deleteFrom("TenantSettingsAudit").where("tenant_id", "=", tenantB).execute();
  });
});

describe("settings.update", () => {
  it("an admin changes each setting and it takes effect", async () => {
    const updated = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.settings.update({
        timezone: "Asia/Singapore",
        vatEnabled: true,
        vatRatePercent: 15,
        varianceToleranceCentavos: 500,
        cashMovementOverrideThresholdCentavos: 100000,
      });

    expect(updated).toStrictEqual({
      timezone: "Asia/Singapore",
      vatEnabled: true,
      vatRatePercent: 15,
      varianceToleranceCentavos: 500,
      cashMovementOverrideThresholdCentavos: 100000,
    });

    const readBack = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.settings.get();
    expect(readBack).toStrictEqual(updated);

    // Restore for later tests that assume the defaults.
    await seam.actors.asTenant(tenantA, { userId: adminA, role: "admin" }).client.settings.update({
      timezone: "Asia/Manila",
      vatEnabled: false,
      vatRatePercent: 12,
      varianceToleranceCentavos: 0,
      cashMovementOverrideThresholdCentavos: 0,
    });
  });

  it("a manager is refused, server-side, and nothing changes", async () => {
    const result = await seam.actors
      .asTenant(tenantA, { userId: managerA, role: "manager" })
      .client.settings.update({
        timezone: "UTC",
        vatEnabled: true,
        vatRatePercent: 99,
        varianceToleranceCentavos: 999,
        cashMovementOverrideThresholdCentavos: 999,
      });
    expect(result).toBeNull();

    const settings = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.settings.get();
    expect(settings?.timezone).toBe("Asia/Manila");
    expect(settings?.vatEnabled).toBe(false);
  });

  it("a cashier is refused, server-side, and nothing changes", async () => {
    const result = await seam.actors
      .asTenant(tenantA, { userId: cashierA, role: "cashier" })
      .client.settings.update({
        timezone: "UTC",
        vatEnabled: true,
        vatRatePercent: 99,
        varianceToleranceCentavos: 999,
        cashMovementOverrideThresholdCentavos: 999,
      });
    expect(result).toBeNull();

    const settings = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.settings.get();
    expect(settings?.vatRatePercent).toBe(12);
  });

  it("writes one audit row per changed setting, naming the actor, the old value, and the new value", async () => {
    await ownerDb.deleteFrom("TenantSettingsAudit").where("tenant_id", "=", tenantA).execute();

    // Change three of five settings — the shared save must write exactly
    // three rows (issue 07 criterion 4), not one and not five.
    const updated = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.settings.update({
        timezone: "Asia/Manila",
        vatEnabled: true,
        vatRatePercent: 20,
        varianceToleranceCentavos: 1000,
        cashMovementOverrideThresholdCentavos: 0,
      });
    expect(updated?.vatEnabled).toBe(true);

    const rows = await ownerDb
      .selectFrom("TenantSettingsAudit")
      .selectAll()
      .where("tenant_id", "=", tenantA)
      .orderBy("setting", "asc")
      .execute();

    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.actor_user_id === adminA)).toBe(true);
    expect(rows.every((row) => row.created_at instanceof Date)).toBe(true);

    const bySetting = Object.fromEntries(rows.map((row) => [row.setting, row]));
    expect(bySetting.vatEnabled).toMatchObject({ old_value: "false", new_value: "true" });
    expect(bySetting.vatRatePercent).toMatchObject({ old_value: "12", new_value: "20" });
    expect(bySetting.varianceToleranceCentavos).toMatchObject({
      old_value: "0",
      new_value: "1000",
    });

    // Restore.
    await seam.actors.asTenant(tenantA, { userId: adminA, role: "admin" }).client.settings.update({
      timezone: "Asia/Manila",
      vatEnabled: false,
      vatRatePercent: 12,
      varianceToleranceCentavos: 0,
      cashMovementOverrideThresholdCentavos: 0,
    });
    await ownerDb.deleteFrom("TenantSettingsAudit").where("tenant_id", "=", tenantA).execute();
  });

  it("a save that changes nothing writes no audit row", async () => {
    await ownerDb.deleteFrom("TenantSettingsAudit").where("tenant_id", "=", tenantA).execute();

    await seam.actors.asTenant(tenantA, { userId: adminA, role: "admin" }).client.settings.update({
      timezone: "Asia/Manila",
      vatEnabled: false,
      vatRatePercent: 12,
      varianceToleranceCentavos: 0,
      cashMovementOverrideThresholdCentavos: 0,
    });

    const rows = await ownerDb
      .selectFrom("TenantSettingsAudit")
      .selectAll()
      .where("tenant_id", "=", tenantA)
      .execute();
    expect(rows).toStrictEqual([]);
  });

  it("the wrong-tenant probe: settings.update has no addressable id, so RLS alone must confine a write to the caller's own Tenant — Tenant B's own write succeeds first, then Tenant A's write is proven not to touch it", async () => {
    // Establish success through Tenant B's own application path first, on
    // all five fields — a write that never happened cannot prove isolation.
    const beforeAsB = await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.settings.update({
        timezone: "Asia/Hong_Kong",
        vatEnabled: true,
        vatRatePercent: 8,
        varianceToleranceCentavos: 3,
        cashMovementOverrideThresholdCentavos: 5,
      });
    expect(beforeAsB).toStrictEqual({
      timezone: "Asia/Hong_Kong",
      vatEnabled: true,
      vatRatePercent: 8,
      varianceToleranceCentavos: 3,
      cashMovementOverrideThresholdCentavos: 5,
    });

    // Tenant A writes its own settings — nothing here can name Tenant B's
    // row, so this is the probe: A's own write must land only on A.
    const asA = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.settings.update({
        timezone: "UTC",
        vatEnabled: true,
        vatRatePercent: 50,
        varianceToleranceCentavos: 12345,
        cashMovementOverrideThresholdCentavos: 12345,
      });
    expect(asA?.timezone).toBe("UTC");

    const afterAsB = await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.settings.get();
    expect(afterAsB).toStrictEqual({
      timezone: "Asia/Hong_Kong",
      vatEnabled: true,
      vatRatePercent: 8,
      varianceToleranceCentavos: 3,
      cashMovementOverrideThresholdCentavos: 5,
    });

    // Restore both tenants.
    await seam.actors.asTenant(tenantA, { userId: adminA, role: "admin" }).client.settings.update({
      timezone: "Asia/Manila",
      vatEnabled: false,
      vatRatePercent: 12,
      varianceToleranceCentavos: 0,
      cashMovementOverrideThresholdCentavos: 0,
    });
    await seam.actors.asTenant(tenantB, { userId: adminB, role: "admin" }).client.settings.update({
      timezone: "Asia/Manila",
      vatEnabled: false,
      vatRatePercent: 12,
      varianceToleranceCentavos: 0,
      cashMovementOverrideThresholdCentavos: 0,
    });
    await ownerDb
      .deleteFrom("TenantSettingsAudit")
      .where("tenant_id", "in", [tenantA, tenantB])
      .execute();
  });
});

describe("an unauthenticated caller", () => {
  it("cannot read or write settings", async () => {
    const read = await seam.actors.asUnauthenticated().client.settings.get();
    expect(read).toBeNull();

    const write = await seam.actors.asUnauthenticated().client.settings.update({
      timezone: "UTC",
      vatEnabled: true,
      vatRatePercent: 99,
      varianceToleranceCentavos: 1,
      cashMovementOverrideThresholdCentavos: 1,
    });
    expect(write).toBeNull();
  });
});
