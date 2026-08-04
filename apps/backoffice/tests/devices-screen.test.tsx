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
  await ownerDb.deleteFrom("UserStore").where("tenant_id", "=", tenantId).execute();
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
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Counter 2 · Downtown")).toBeTruthy();
    expect(within(dialog).getByText("Single-use. Enter it on the terminal.")).toBeTruthy();
    expect(within(dialog).getByText(/Expires in 10 minutes/)).toBeTruthy();

    // The enrolment outlives its dialog: closing it leaves the code listed,
    // and the same code opens again from there.
    fireEvent.click(within(dialog).getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    // Axe runs with no modal open — a modal aria-hides the page behind it,
    // which the `aria-hidden-focus` rule reads as a violation (record 008).
    await expectNoAxeViolations(container);

    fireEvent.click(await screen.findByRole("button", { name: "View code" }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Enrolment code" })).toBeTruthy(),
    );

    // The terminal redeems the code out of band; the dialog polls the list and
    // closes itself once the Device carrying that code exists.
    await withTenantScope(ownerDb, tenantId, (scoped) =>
      scoped
        .insertInto("Device")
        .values({
          id: randomUUID(),
          tenant_id: tenantId,
          store_id: storeId,
          name: "Counter 2",
          code: "C2",
          token_hash: `counter-2-${randomUUID()}`,
        })
        .execute(),
    );

    await waitFor(
      () => expect(screen.queryByRole("heading", { name: "Enrolment code" })).toBeNull(),
      { timeout: 10_000 },
    );
    // The poll runs on a 3s interval, so this test outlives the 5s default.
  }, 25_000);

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

  it("issue 17: restricts a Device to one eligible User, then clears the restriction — WCAG 2.2 AA on the dialog", async () => {
    const deviceId = randomUUID();
    const cashierId = randomUUID();
    const passwordHash = await hashPassword("irrelevant");
    await ownerDb
      .insertInto("User")
      .values({
        id: cashierId,
        tenant_id: tenantId,
        email: `devices-screen-cashier-${randomUUID()}@pm.test`,
        password_hash: passwordHash,
        first_name: "Fay",
        last_name: "Ibarra",
        role: "cashier",
      })
      .execute();
    await withTenantScope(ownerDb, tenantId, (db) =>
      db
        .insertInto("UserStore")
        .values({
          id: randomUUID(),
          tenant_id: tenantId,
          user_id: cashierId,
          store_id: storeId,
          assigned: true,
          effective_from: new Date(Date.now() - 60_000),
        })
        .execute(),
    );
    await withTenantScope(ownerDb, tenantId, (db) =>
      db
        .insertInto("Device")
        .values({
          id: deviceId,
          tenant_id: tenantId,
          store_id: storeId,
          name: "Counter 17",
          code: "C17",
          token_hash: "irrelevant-hash-17",
        })
        .execute(),
    );

    const { db } = renderRoute({
      router,
      tenantId,
      userId: adminId,
      role: "admin",
      initialLocation: "/devices",
    });
    cleanup = async () => {
      await db.destroy();
    };

    await waitFor(() => expect(screen.getByText("Counter 17")).toBeTruthy());
    const row = screen.getByText("Counter 17").closest("tr")!;
    // The accessible name is the action ("Restrict {name}"), same as Rename
    // and Revoke — the visible label ("Restrict"/"Restricted") is separate.
    fireEvent.click(within(row).getByRole("button", { name: "Restrict Counter 17" }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Restrict Counter 17" })).toBeTruthy(),
    );
    await expectNoAxeViolations(screen.getByRole("dialog"));

    fireEvent.click(screen.getByRole("combobox"));
    await waitFor(() => expect(screen.getByRole("option", { name: "Fay Ibarra" })).toBeTruthy());
    fireEvent.click(screen.getByRole("option", { name: "Fay Ibarra" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      const updatedRow = screen.getByText("Counter 17").closest("tr")!;
      expect(within(updatedRow).getByText("Restricted")).toBeTruthy();
    });

    const stored = await withTenantScope(ownerDb, tenantId, (db) =>
      db
        .selectFrom("Device")
        .select(["assigned_user_id"])
        .where("id", "=", deviceId)
        .executeTakeFirst(),
    );
    expect(stored?.assigned_user_id).toBe(cashierId);

    // Clear it back to open-to-all.
    const restrictedRow = screen.getByText("Counter 17").closest("tr")!;
    fireEvent.click(within(restrictedRow).getByRole("button", { name: "Restrict Counter 17" }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Restrict Counter 17" })).toBeTruthy(),
    );
    fireEvent.click(screen.getByRole("combobox"));
    await waitFor(() => expect(screen.getByRole("option", { name: "Open to all" })).toBeTruthy());
    fireEvent.click(screen.getByRole("option", { name: "Open to all" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      const clearedRow = screen.getByText("Counter 17").closest("tr")!;
      expect(within(clearedRow).getByText("Restrict")).toBeTruthy();
    });

    const clearedStored = await withTenantScope(ownerDb, tenantId, (db) =>
      db
        .selectFrom("Device")
        .select(["assigned_user_id"])
        .where("id", "=", deviceId)
        .executeTakeFirst(),
    );
    expect(clearedStored?.assigned_user_id).toBeNull();

    await ownerDb.deleteFrom("UserStore").where("user_id", "=", cashierId).execute();
    await ownerDb.deleteFrom("User").where("id", "=", cashierId).execute();
  });
});

describe("the Devices screen — as a manager", () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await cleanup?.();
    cleanup = undefined;
  });

  it("the route refuses: a manager navigating directly gets NotFoundState, never the screen", async () => {
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

    // `_shell`'s own guard refuses, `notFound()` never a redirect (issue 15,
    // record 063 §1) — the URL stays put, the destination never renders.
    await waitFor(() => expect(screen.getByText("That page doesn’t exist.")).toBeTruthy());
    expect(window.location.pathname).toBe("/devices");
    expect(screen.queryByRole("heading", { name: "Devices" })).toBeNull();
  });
});
