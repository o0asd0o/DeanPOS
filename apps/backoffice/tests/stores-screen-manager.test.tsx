import { randomUUID } from "node:crypto";

import { createDb, withTenantScope } from "backend/src/db/client.ts";
import { hashPassword } from "backend/src/common/password.ts";
import { expectNoAxeViolations, renderRoute, screen, waitFor } from "api/src/test-seam-react.tsx";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vite-plus/test";

import { router } from "@/router.tsx";

// Record 038 §6: what a `manager` sees. Its own file/tenant, isolated from
// the admin-flow mutation tests, which touch the same route repeatedly.
const ownerDb = createDb({ databaseUrl: process.env.DATABASE_URI! });

const tenantId = randomUUID();
const managerId = randomUUID();
const assignedStoreId = randomUUID();
const unassignedStoreId = randomUUID();

beforeAll(async () => {
  await ownerDb
    .insertInto("Tenant")
    .values({ id: tenantId, name: "Stores Screen Manager Tenant" })
    .execute();
  await ownerDb
    .insertInto("User")
    .values({
      id: managerId,
      tenant_id: tenantId,
      email: `stores-screen-manager-${randomUUID()}@store.test`,
      password_hash: await hashPassword("irrelevant"),
      role: "manager",
    })
    .execute();

  await withTenantScope(ownerDb, tenantId, (db) =>
    db
      .insertInto("Store")
      .values([
        { id: assignedStoreId, tenant_id: tenantId, name: "Assigned Outlet" },
        { id: unassignedStoreId, tenant_id: tenantId, name: "Unassigned Outlet" },
      ])
      .execute(),
  );
  await withTenantScope(ownerDb, tenantId, (db) =>
    db
      .insertInto("UserStore")
      .values({
        id: randomUUID(),
        tenant_id: tenantId,
        user_id: managerId,
        store_id: assignedStoreId,
        assigned: true,
        effective_from: new Date(Date.now() - 60_000),
      })
      .execute(),
  );
});

afterAll(async () => {
  await ownerDb.deleteFrom("UserStore").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Store").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("User").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Tenant").where("id", "=", tenantId).execute();
  await ownerDb.destroy();
});

describe("the Stores screen — as a manager", () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await cleanup?.();
    cleanup = undefined;
  });

  it("sees only their assigned Store, read-only: no Add store, no actions column", async () => {
    const { container, db } = renderRoute({
      router,
      tenantId,
      userId: managerId,
      role: "manager",
      initialLocation: "/stores",
    });
    cleanup = () => db.destroy();

    await waitFor(() => expect(screen.getByText("Assigned Outlet")).toBeTruthy());
    expect(screen.queryByText("Unassigned Outlet")).toBeNull();
    expect(screen.queryByRole("button", { name: "Add store" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Edit/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Deactivate/ })).toBeNull();
    expect(screen.queryByText("Actions")).toBeNull();

    await expectNoAxeViolations(container);
  });
});
