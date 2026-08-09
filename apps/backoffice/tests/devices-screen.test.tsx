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

  it("clears device filters from the filtered empty state", async () => {
    await withTenantScope(ownerDb, tenantId, (db) =>
      db
        .insertInto("Device")
        .values({
          id: randomUUID(),
          tenant_id: tenantId,
          store_id: storeId,
          name: "Filter target",
          code: "FT",
          token_hash: `filter-target-${randomUUID()}`,
        })
        .execute(),
    );

    const { db } = renderRoute({
      router,
      tenantId,
      userId: adminId,
      role: "admin",
      initialLocation: "/devices?q=missing-device",
    });
    cleanup = () => db.destroy();

    await waitFor(() => expect(screen.getByText("No devices match these filters")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    await waitFor(() => expect(screen.getByText("Filter target")).toBeTruthy());
    expect(window.location.search).toContain("q=");
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
    // Cleared again, the column reads "Open to all" once the refetch lands.
    const clearedRow = screen.getByText("Counter 17").closest("tr")!;
    await waitFor(() => expect(within(clearedRow).getByText("Open to all")).toBeTruthy());

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

  // The toolbar's Store control is conditional on the fleet spanning more
  // than one Store — one Store filters nothing (record 056 Q5).
  it("a single store earns no Store control in the toolbar", async () => {
    const { db } = renderRoute({
      router,
      tenantId,
      userId: adminId,
      role: "admin",
      initialLocation: "/devices",
    });
    cleanup = () => db.destroy();

    await waitFor(() => expect(screen.getByRole("heading", { name: "Devices" })).toBeTruthy());
    expect(screen.queryByRole("combobox")).toBeNull();
    // The health pills are the fleet's own status filter.
    expect(screen.getByRole("button", { name: "Show offline" })).toBeTruthy();
  });
});

describe("the Devices toolbar — health, store, and search filters", () => {
  let cleanup: (() => Promise<void>) | undefined;
  // Present from the start of this describe (the single-store case is proven
  // in the admin describe above); the suite's own afterAll removes every
  // Store for the tenant regardless.
  const cubaoStoreId = randomUUID();

  beforeAll(async () => {
    // The admin describe above leaves its Devices behind; wipe them so these
    // tests own the whole fleet (FK order: audit, codes, then devices).
    await ownerDb.deleteFrom("DeviceAudit").where("tenant_id", "=", tenantId).execute();
    await ownerDb.deleteFrom("EnrolmentCode").where("tenant_id", "=", tenantId).execute();
    await ownerDb.deleteFrom("Device").where("tenant_id", "=", tenantId).execute();
    await withTenantScope(ownerDb, tenantId, (db) =>
      db
        .insertInto("Store")
        .values({ id: cubaoStoreId, tenant_id: tenantId, name: "Cubao" })
        .execute(),
    );
  });

  afterEach(async () => {
    await cleanup?.();
    cleanup = undefined;
  });

  it("health pills split the fleet by last seen, and the choice lands in the URL", async () => {
    // Counter 21 just seen — Online. Counter 22 thirty minutes ago — Stale.
    // Counter 23 two days ago — Offline. Counter 24 revoked — Offline too.
    await withTenantScope(ownerDb, tenantId, (db) =>
      db
        .insertInto("Device")
        .values([
          {
            id: randomUUID(),
            tenant_id: tenantId,
            store_id: storeId,
            name: "Counter 21",
            code: "C21",
            token_hash: `h21-${randomUUID()}`,
            last_seen_at: new Date(Date.now() - 60_000),
          },
          {
            id: randomUUID(),
            tenant_id: tenantId,
            store_id: storeId,
            name: "Counter 22",
            code: "C22",
            token_hash: `h22-${randomUUID()}`,
            last_seen_at: new Date(Date.now() - 30 * 60_000),
          },
          {
            id: randomUUID(),
            tenant_id: tenantId,
            store_id: storeId,
            name: "Counter 23",
            code: "C23",
            token_hash: `h23-${randomUUID()}`,
            last_seen_at: new Date(Date.now() - 2 * 24 * 60 * 60_000),
          },
          {
            id: randomUUID(),
            tenant_id: tenantId,
            store_id: storeId,
            name: "Counter 24",
            code: "C24",
            token_hash: `h24-${randomUUID()}`,
            last_seen_at: new Date(Date.now() - 60_000),
            revoked_at: new Date(Date.now() - 60_000),
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
    cleanup = () => db.destroy();

    await waitFor(() => expect(screen.getByText("Counter 21")).toBeTruthy());

    // Offline is the grey end of the health scale, and a revoked Device is
    // grey too — it reads Offline, not a separate state (record 056 Q5).
    fireEvent.click(screen.getByRole("button", { name: "Show offline" }));
    await waitFor(() => expect(screen.queryByText("Counter 21")).toBeNull());
    expect(screen.getByText("Counter 23")).toBeTruthy();
    expect(screen.getByText("Counter 24")).toBeTruthy();
    expect(screen.queryByText("Counter 22")).toBeNull();
    expect(window.location.search).toContain("health=offline");

    fireEvent.click(screen.getByRole("button", { name: "Show stale" }));
    await waitFor(() => expect(screen.getByText("Counter 22")).toBeTruthy());
    expect(screen.queryByText("Counter 21")).toBeNull();
    expect(screen.queryByText("Counter 23")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Show online" }));
    await waitFor(() => expect(screen.getByText("Counter 21")).toBeTruthy());
    expect(screen.queryByText("Counter 23")).toBeNull();
  });

  it("a second store earns the Store control, which filters by it", async () => {
    await withTenantScope(ownerDb, tenantId, (db) =>
      db
        .insertInto("Device")
        .values([
          {
            id: randomUUID(),
            tenant_id: tenantId,
            store_id: storeId,
            name: "Counter 31",
            code: "C31",
            token_hash: `h31-${randomUUID()}`,
          },
          {
            id: randomUUID(),
            tenant_id: tenantId,
            store_id: cubaoStoreId,
            name: "Counter 32",
            code: "C32",
            token_hash: `h32-${randomUUID()}`,
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
    cleanup = () => db.destroy();

    await waitFor(() => expect(screen.getByText("Counter 31")).toBeTruthy());
    await waitFor(() => expect(screen.getByText("Counter 32")).toBeTruthy());

    // The stores query settles behind the device rows — the control appears
    // once the Store map has both entries.
    const storeSelect = await screen.findByRole("combobox");
    fireEvent.click(storeSelect);
    await waitFor(() => expect(screen.getByRole("option", { name: "Cubao" })).toBeTruthy());
    fireEvent.click(screen.getByRole("option", { name: "Cubao" }));
    await waitFor(() => expect(screen.queryByText("Counter 31")).toBeNull());
    expect(screen.getByText("Counter 32")).toBeTruthy();
    expect(window.location.search).toContain(`store=${cubaoStoreId}`);

    // Back to the whole fleet.
    fireEvent.click(screen.getByRole("combobox"));
    await waitFor(() => expect(screen.getByRole("option", { name: "All stores" })).toBeTruthy());
    fireEvent.click(screen.getByRole("option", { name: "All stores" }));
    await waitFor(() => expect(screen.getByText("Counter 31")).toBeTruthy());
  });

  it("search matches the Store and the assigned user, not just the name and code", async () => {
    const cashierId = randomUUID();
    const passwordHash = await hashPassword("irrelevant");
    await ownerDb
      .insertInto("User")
      .values({
        id: cashierId,
        tenant_id: tenantId,
        email: `devices-toolbar-cashier-${randomUUID()}@pm.test`,
        password_hash: passwordHash,
        first_name: "Maria",
        last_name: "Clara",
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
            id: randomUUID(),
            tenant_id: tenantId,
            store_id: storeId,
            name: "Counter 41",
            code: "C41",
            token_hash: `h41-${randomUUID()}`,
            assigned_user_id: cashierId,
          },
          {
            id: randomUUID(),
            tenant_id: tenantId,
            store_id: cubaoStoreId,
            name: "Counter 42",
            code: "C42",
            token_hash: `h42-${randomUUID()}`,
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
      // The device still names its assignee, and the FK is RESTRICT — clear
      // the reference before the user itself goes.
      await withTenantScope(ownerDb, tenantId, (db) =>
        db
          .updateTable("Device")
          .set({ assigned_user_id: null })
          .where("assigned_user_id", "=", cashierId)
          .execute(),
      );
      await ownerDb.deleteFrom("UserStore").where("user_id", "=", cashierId).execute();
      await ownerDb.deleteFrom("User").where("id", "=", cashierId).execute();
    };

    await waitFor(() => expect(screen.getByText("Counter 41")).toBeTruthy());
    await waitFor(() => expect(screen.getByText("Counter 42")).toBeTruthy());

    fireEvent.change(screen.getByLabelText("Search devices"), {
      target: { value: "cubao" },
    });
    await waitFor(() => expect(screen.queryByText("Counter 41")).toBeNull());
    // The store-name match rides the stores query settling, which trails the
    // device rows — wait for it rather than reading the row on the instant.
    await waitFor(() => expect(screen.getByText("Counter 42")).toBeTruthy());
    expect(window.location.search).toContain("q=cubao");

    fireEvent.change(screen.getByLabelText("Search devices"), {
      target: { value: "clara" },
    });
    await waitFor(() => expect(screen.queryByText("Counter 42")).toBeNull());
    await waitFor(() => expect(screen.getByText("Counter 41")).toBeTruthy());

    // The name search still works — Counter 41 by its own name.
    fireEvent.change(screen.getByLabelText("Search devices"), {
      target: { value: "Counter 41" },
    });
    await waitFor(() => expect(screen.getByText("Counter 41")).toBeTruthy());
  });

  it("paginates server-side: the strip appears past one page, and page 2 lands in the URL", async () => {
    // Own the set — the earlier toolbar tests leave eight Devices behind,
    // which would blur which page holds what.
    await ownerDb.deleteFrom("DeviceAudit").where("tenant_id", "=", tenantId).execute();
    await ownerDb.deleteFrom("EnrolmentCode").where("tenant_id", "=", tenantId).execute();
    await ownerDb.deleteFrom("Device").where("tenant_id", "=", tenantId).execute();
    await withTenantScope(ownerDb, tenantId, (db) =>
      db
        .insertInto("Device")
        .values(
          // Zero-padded so the name sort is stable across the two pages.
          Array.from({ length: 12 }, (_, i) => ({
            id: randomUUID(),
            tenant_id: tenantId,
            store_id: storeId,
            name: `Counter ${String(i + 1).padStart(2, "0")}`,
            code: `C${i + 1}`,
            token_hash: `page-${randomUUID()}`,
          })),
        )
        .execute(),
    );

    const { db } = renderRoute({
      router,
      tenantId,
      userId: adminId,
      role: "admin",
      initialLocation: "/devices",
    });
    cleanup = () => db.destroy();

    // Page 1 holds ten rows; the strip only appears now there is a page 2.
    await waitFor(() => expect(screen.getByText("Counter 01")).toBeTruthy());
    expect(screen.queryByText("Counter 11")).toBeNull();
    expect(screen.getByRole("navigation", { name: "Devices pages" })).toBeTruthy();

    // Header clicks sort server-side — the sort rides the URL: "Last seen"
    // asc, then desc, then back to the name-asc default the assertions
    // below rely on.
    fireEvent.click(screen.getByRole("button", { name: "Last seen" }));
    await waitFor(() => expect(window.location.search).toContain("lastSeen"));
    fireEvent.click(screen.getByRole("button", { name: "Last seen" }));
    await waitFor(() => expect(window.location.search).toContain("desc"));
    fireEvent.click(screen.getByRole("button", { name: "Device" }));
    await waitFor(() => expect(screen.getByText("Counter 01")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "Page 2" }));
    await waitFor(() => expect(screen.getByText("Counter 11")).toBeTruthy());
    expect(screen.queryByText("Counter 01")).toBeNull();
    expect(window.location.search).toContain("page=2");
  }, 15_000);
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
