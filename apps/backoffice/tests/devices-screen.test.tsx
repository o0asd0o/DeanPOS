import { randomUUID } from "node:crypto";

import {
  createDb,
  expectNoAxeViolations,
  fireEvent,
  hashPassword,
  renderRoute,
  screen,
  waitFor,
  withTenantScope,
  within,
} from "api/src/test-seam-react.tsx";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vite-plus/test";

import { router } from "@/router.tsx";

// The Devices screen (issue 09, record 056 Q5) — no lofi mock beyond a
// superseded drawing; record 056 is the contract.
const ownerDb = createDb({ databaseUrl: process.env.DATABASE_URI! });

const tenantId = randomUUID();
const adminId = randomUUID();
const storeId = randomUUID();

beforeAll(async () => {
  await ownerDb
    .insertInto("Tenant")
    .values({ id: tenantId, name: "Devices Screen Tenant" })
    .execute();
  const passwordHash = await hashPassword("irrelevant");
  await ownerDb
    .insertInto("User")
    .values({
      id: adminId,
      tenant_id: tenantId,
      email: `devices-screen-admin-${randomUUID()}@pm.test`,
      password_hash: passwordHash,
      role: "admin",
    })
    .execute();
  await withTenantScope(ownerDb, tenantId, (db) =>
    db.insertInto("Store").values({ id: storeId, tenant_id: tenantId, name: "Downtown" }).execute(),
  );
});

afterAll(async () => {
  await ownerDb.deleteFrom("DeviceAudit").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("EnrolmentCode").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Device").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Store").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("User").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Tenant").where("id", "=", tenantId).execute();
  await ownerDb.destroy();
});

describe("the Devices screen — as an admin", () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await cleanup?.();
    cleanup = undefined;
  });

  it("shows the unfiltered empty state, generates a code, and shows the result", async () => {
    const { container, db } = renderRoute({
      router,
      tenantId,
      userId: adminId,
      role: "admin",
      initialLocation: "/devices",
    });
    cleanup = () => db.destroy();

    await waitFor(() => expect(screen.getByRole("heading", { name: "Devices" })).toBeTruthy());
    await waitFor(() => expect(screen.getByText("No devices yet")).toBeTruthy());
    expect(
      screen.getByText("Enrol a terminal to start taking sales at the till", { exact: false }),
    ).toBeTruthy();

    await expectNoAxeViolations(container);

    fireEvent.click(screen.getByRole("button", { name: "Enrol a device" }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Enrol a device" })).toBeTruthy(),
    );

    await waitFor(() => expect(screen.getByLabelText("Name")).toBeTruthy());
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Counter 2" } });
    fireEvent.change(screen.getByLabelText("Short code"), { target: { value: "c2" } });
    fireEvent.click(screen.getByRole("button", { name: "Generate code" }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Enrolment code" })).toBeTruthy(),
    );
    expect(screen.getByText("Counter 2 · Downtown")).toBeTruthy();
    expect(screen.getByText("Single-use. Enter it on the terminal.")).toBeTruthy();
    expect(screen.getByText(/Expires in 10 minutes/)).toBeTruthy();

    await expectNoAxeViolations(container);
  });

  it("lists an enrolled Device with its code, Store, and status, and revokes it", async () => {
    const deviceId = randomUUID();
    await withTenantScope(ownerDb, tenantId, (db) =>
      db
        .insertInto("Device")
        .values({
          id: deviceId,
          tenant_id: tenantId,
          store_id: storeId,
          name: "Counter 9",
          code: "C9",
          token_hash: "irrelevant-hash",
        })
        .execute(),
    );

    const { container, db } = renderRoute({
      router,
      tenantId,
      userId: adminId,
      role: "admin",
      initialLocation: "/devices",
    });
    cleanup = async () => {
      await db.destroy();
    };

    // The Store column depends on a second query (store.list) settling
    // after the device row itself is visible — wait for it too.
    await waitFor(() => {
      const row = screen.getByText("Counter 9").closest("tr")!;
      expect(within(row).getByText("Downtown")).toBeTruthy();
    });
    const row = screen.getByText("Counter 9").closest("tr")!;
    expect(within(row).getByText("C9")).toBeTruthy();
    expect(within(row).getByText("Active")).toBeTruthy();
    expect(within(row).getByRole("button", { name: /^Revoke/ })).toBeTruthy();

    await expectNoAxeViolations(container);

    fireEvent.click(within(row).getByRole("button", { name: /^Revoke/ }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /Revoke Counter 9/ })).toBeTruthy(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Revoke" }));

    await waitFor(() => {
      const updatedRow = screen.getByText("Counter 9").closest("tr")!;
      expect(within(updatedRow).getByText("Revoked")).toBeTruthy();
    });
    const revokedRow = screen.getByText("Counter 9").closest("tr")!;
    expect(within(revokedRow).queryByRole("button", { name: /^Revoke/ })).toBeNull();
    expect(within(revokedRow).getByRole("button", { name: /^Rename/ })).toBeTruthy();

    await expectNoAxeViolations(container);
  });
});

describe("the Devices screen — as a manager", () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await cleanup?.();
    cleanup = undefined;
  });

  it("the route refuses: a manager navigating directly is redirected away, never shown the screen", async () => {
    const managerId = randomUUID();
    const passwordHash = await hashPassword("irrelevant");
    await ownerDb
      .insertInto("User")
      .values({
        id: managerId,
        tenant_id: tenantId,
        email: `devices-screen-manager-${randomUUID()}@pm.test`,
        password_hash: passwordHash,
        role: "manager",
      })
      .execute();

    const { db } = renderRoute({
      router,
      tenantId,
      userId: managerId,
      role: "manager",
      initialLocation: "/devices",
    });
    cleanup = async () => {
      await db.destroy();
      await ownerDb.deleteFrom("User").where("id", "=", managerId).execute();
    };

    await waitFor(() => expect(window.location.pathname).toBe("/"));
    expect(screen.queryByRole("heading", { name: "Devices" })).toBeNull();
  });
});
