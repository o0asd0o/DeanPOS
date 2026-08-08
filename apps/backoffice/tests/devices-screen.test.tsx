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

// Row actions (Rename, Revoke) live behind one `⋯` menu per Device (record
// 056 Q5) — assignment is edited straight from its own column. Radix opens a
// menu on pointerdown, which happy-dom's `click` does not imply (record 042),
// and item selection closes it again.
const openRowMenu = async (row: HTMLElement) => {
  const trigger = within(row).getByRole("button", { name: /^Actions for/ });
  fireEvent.pointerDown(trigger, { button: 0, pointerType: "mouse" });
  return waitFor(() => screen.getByRole("menu"));
};

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
    expect(within(row).getByRole("button", { name: "Actions for Counter 9" })).toBeTruthy();

    await expectNoAxeViolations(container);

    const menu = await openRowMenu(row);
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Revoke" }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /Revoke Counter 9/ })).toBeTruthy(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Revoke" }));

    await waitFor(() => {
      const updatedRow = screen.getByText("Counter 9").closest("tr")!;
      expect(within(updatedRow).getByText("Revoked")).toBeTruthy();
    });
    // A revoked Device keeps Edit in the menu, but Revoke is dropped; its
    // Assigned to column stays as-is.
    const revokedRow = screen.getByText("Counter 9").closest("tr")!;
    const revokedMenu = await openRowMenu(revokedRow);
    expect(within(revokedMenu).queryByRole("menuitem", { name: "Revoke" })).toBeNull();
    expect(within(revokedMenu).getByRole("menuitem", { name: "Edit" })).toBeTruthy();
    // The open menu is modal: it aria-hides the page behind it (record 008),
    // so close it before axe — Escape, since the trigger is hidden too.
    fireEvent.keyDown(revokedMenu, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());

    await expectNoAxeViolations(container);
  });

  it("issue 17: assigns a Device to one eligible User, then clears the assignment — WCAG 2.2 AA on the dialog", async () => {
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
    // Both editable fields live in one Edit sheet, opened from the `⋯` menu;
    // the column itself is plain text ("Open to all" until a User is pinned).
    expect(within(row).getByText("Open to all")).toBeTruthy();
    const menu = await openRowMenu(row);
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Edit" }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Edit Counter 17" })).toBeTruthy(),
    );
    await expectNoAxeViolations(screen.getByRole("dialog"));

    fireEvent.click(screen.getByRole("combobox"));
    await waitFor(() => expect(screen.getByRole("option", { name: "Fay Ibarra" })).toBeTruthy());
    fireEvent.click(screen.getByRole("option", { name: "Fay Ibarra" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    // Pinned to Fay, the column shows her name.
    await waitFor(() => {
      const pinnedRow = screen.getByText("Counter 17").closest("tr")!;
      expect(within(pinnedRow).getByText("Fay Ibarra")).toBeTruthy();
    });
    // Reopening the sheet starts from the saved assignment.
    const pinnedRow = screen.getByText("Counter 17").closest("tr")!;
    const pinnedMenu = await openRowMenu(pinnedRow);
    fireEvent.click(within(pinnedMenu).getByRole("menuitem", { name: "Edit" }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Edit Counter 17" })).toBeTruthy(),
    );

    const stored = await withTenantScope(ownerDb, tenantId, (db) =>
      db
        .selectFrom("Device")
        .select(["assigned_user_id"])
        .where("id", "=", deviceId)
        .executeTakeFirst(),
    );
    expect(stored?.assigned_user_id).toBe(cashierId);

    // Clear it back to open-to-all.
    fireEvent.click(screen.getByRole("combobox"));
    await waitFor(() => expect(screen.getByRole("option", { name: "Open to all" })).toBeTruthy());
    fireEvent.click(screen.getByRole("option", { name: "Open to all" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    // Cleared again, the column reads "Open to all".
    const clearedRow = screen.getByText("Counter 17").closest("tr")!;
    expect(within(clearedRow).getByText("Open to all")).toBeTruthy();

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

  it("issue 17: closing the editor for an assigned Device and reopening it for a different, open-to-all Device does not carry the first selection over", async () => {
    const restrictedDeviceId = randomUUID();
    const openDeviceId = randomUUID();
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
        .values([
          {
            id: restrictedDeviceId,
            tenant_id: tenantId,
            store_id: storeId,
            name: "Counter 18",
            code: "C18",
            token_hash: "irrelevant-hash-18",
            assigned_user_id: cashierId,
          },
          {
            id: openDeviceId,
            tenant_id: tenantId,
            store_id: storeId,
            name: "Counter 19",
            code: "C19",
            token_hash: "irrelevant-hash-19",
          },
        ])
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

    await waitFor(() => expect(screen.getByText("Counter 18")).toBeTruthy());
    const restrictedRow = screen.getByText("Counter 18").closest("tr")!;
    // Pre-assigned in the fixture: the column shows her name once the users
    // query settles (it feeds the name map).
    await waitFor(() => expect(within(restrictedRow).getByText("Fay Ibarra")).toBeTruthy());
    let menu = await openRowMenu(restrictedRow);
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Edit" }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Edit Counter 18" })).toBeTruthy(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    const openRow = screen.getByText("Counter 19").closest("tr")!;
    expect(within(openRow).getByText("Open to all")).toBeTruthy();
    menu = await openRowMenu(openRow);
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Edit" }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Edit Counter 19" })).toBeTruthy(),
    );
    expect(screen.getByRole("combobox").textContent).toBe("Open to all");
    // The sheet only submits when something changed, so dirty the name with a
    // trailing space — it trims back to "Counter 19", leaving the row as-is.
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Counter 19 " } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    // Saving "Open to all" leaves the column unchanged.
    const savedRow = screen.getByText("Counter 19").closest("tr")!;
    expect(within(savedRow).getByText("Open to all")).toBeTruthy();

    const stored = await withTenantScope(ownerDb, tenantId, (db) =>
      db
        .selectFrom("Device")
        .select(["assigned_user_id"])
        .where("id", "=", openDeviceId)
        .executeTakeFirst(),
    );
    expect(stored?.assigned_user_id).toBeNull();

    // The cancelled dialog left restrictedDeviceId's assignment in place.
    await withTenantScope(ownerDb, tenantId, (db) =>
      db
        .updateTable("Device")
        .set({ assigned_user_id: null })
        .where("id", "=", restrictedDeviceId)
        .execute(),
    );
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
