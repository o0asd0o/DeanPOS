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

// The User management screen (records 043, 044, 045) — no lofi mock beyond
// the whole-screen reference; these records are the contract.
const ownerDb = createDb({ databaseUrl: process.env.DATABASE_URI! });

const tenantId = randomUUID();
const adminId = randomUUID();
const storeId = randomUUID();

const openRowMenu = async (row: HTMLElement) => {
  const trigger = within(row).getByRole("button", { name: /^Actions for/ });
  fireEvent.pointerDown(trigger, { button: 0, pointerType: "mouse" });
  return waitFor(() => screen.getByRole("menu"));
};

beforeAll(async () => {
  await ownerDb
    .insertInto("Tenant")
    .values({ id: tenantId, name: "Users Screen Tenant" })
    .execute();
  const passwordHash = await hashPassword("irrelevant");
  await ownerDb
    .insertInto("User")
    .values({
      id: adminId,
      tenant_id: tenantId,
      email: `users-screen-admin-${randomUUID()}@user.test`,
      password_hash: passwordHash,
      role: "admin",
    })
    .execute();
  await withTenantScope(ownerDb, tenantId, (db) =>
    db.insertInto("Store").values({ id: storeId, tenant_id: tenantId, name: "Downtown" }).execute(),
  );
});

afterAll(async () => {
  await ownerDb.deleteFrom("UserStore").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("UserRole").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Store").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("User").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Tenant").where("id", "=", tenantId).execute();
  await ownerDb.destroy();
});

describe("the Users screen — as an admin", () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await cleanup?.();
    cleanup = undefined;
  });

  it("creates a User with a typed temporary password, lists it, and shows no delete anywhere", async () => {
    const { container, db, queryClient } = renderRoute({
      router,
      tenantId,
      userId: adminId,
      role: "admin",
      initialLocation: "/employees",
    });
    cleanup = () => db.destroy();

    await waitFor(() => expect(screen.getByRole("heading", { name: "Employees" })).toBeTruthy());
    expect(screen.getByRole("button", { name: "Add employee" })).toBeTruthy();
    await expectNoAxeViolations(container);

    fireEvent.click(screen.getByRole("button", { name: "Add employee" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "New employee" })).toBeTruthy());
    expect(document.activeElement).toBe(screen.getByLabelText("Email"));

    const newEmail = `new-hire-${randomUUID()}@user.test`;
    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Ana" } });
    fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "Reyes" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: newEmail } });

    const passwordField = screen.getByLabelText("Temporary password") as HTMLInputElement;
    expect(passwordField.type).toBe("password");
    expect(passwordField.getAttribute("autocomplete")).toBe("new-password");
    // Record 052: a temporary password's floor is 6, not the 8 a User picks.
    expect(passwordField.getAttribute("minlength")).toBe("6");
    expect(passwordField.getAttribute("maxlength")).toBeNull();
    fireEvent.change(passwordField, { target: { value: "a temporary password" } });

    await waitFor(() => expect(screen.getByLabelText("Downtown")).toBeTruthy());
    fireEvent.click(screen.getByLabelText("Downtown"));

    fireEvent.click(screen.getByRole("button", { name: "Create employee" }));

    await waitFor(() => expect(screen.queryByRole("heading", { name: "New employee" })).toBeNull());
    await waitFor(() => expect(screen.getByText(newEmail)).toBeTruthy());
    // Record 053 amends 044's "no Name column".
    expect(screen.getByRole("columnheader", { name: "Name" })).toBeTruthy();
    expect(screen.getByText("Ana Reyes")).toBeTruthy();

    const row = screen.getByText(newEmail).closest("tr")!;
    expect(within(row).getByText("Cashier")).toBeTruthy();
    expect(within(row).getByText("Downtown")).toBeTruthy();
    expect(within(row).getByText("Active")).toBeTruthy();

    // No password anywhere on the page (record 043 no-go 2).
    expect(container.textContent).not.toMatch(/a temporary password/);
    expect(container.textContent?.toLowerCase()).not.toMatch(/delete|permanently/);
    await expectNoAxeViolations(container);

    // Nor retained in TanStack Query's MutationCache — `reset()` alone
    // detaches the observer but leaves the entry there for its GC window.
    const cachedVariables = queryClient
      .getMutationCache()
      .getAll()
      .map((mutation) => JSON.stringify(mutation.state.variables));
    expect(cachedVariables.some((entry) => entry.includes("a temporary password"))).toBe(false);
  });

  it("has no PIN column and never truncates the email (record 044)", async () => {
    const { db } = renderRoute({
      router,
      tenantId,
      userId: adminId,
      role: "admin",
      initialLocation: "/employees",
    });
    cleanup = () => db.destroy();

    await waitFor(() => expect(screen.queryByText("Loading…")).toBeNull());
    expect(screen.queryByText("PIN")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Reset PIN/ })).toBeNull();
  });

  it("promotes and reassigns a User through the editor, and the role history stays readable", async () => {
    const targetId = randomUUID();
    const targetEmail = `promote-screen-${randomUUID()}@user.test`;
    const passwordHash = await hashPassword("irrelevant");
    await ownerDb
      .insertInto("User")
      .values({
        id: targetId,
        tenant_id: tenantId,
        email: targetEmail,
        password_hash: passwordHash,
        role: "cashier",
      })
      .execute();
    await ownerDb
      .insertInto("UserRole")
      .values({
        id: randomUUID(),
        tenant_id: tenantId,
        user_id: targetId,
        role: "cashier",
        effective_from: new Date(Date.now() - 60_000),
      })
      .execute();

    const { db } = renderRoute({
      router,
      tenantId,
      userId: adminId,
      role: "admin",
      initialLocation: "/employees",
    });
    cleanup = () => db.destroy();

    await waitFor(() => expect(screen.getByText(targetEmail)).toBeTruthy());
    const row = screen.getByText(targetEmail).closest("tr")!;
    const menu = await openRowMenu(row);
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Edit" }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: `Edit ${targetEmail}` })).toBeTruthy(),
    );
    // Email is create-only — no Email field in the edit form (record 045 §1).
    expect(screen.queryByLabelText("Email")).toBeNull();
    // Reset password lives here, not a separate confirm-password field.
    expect(screen.getByRole("button", { name: "Reset password" })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close" }));

    // Let the editor's own Stores checkbox list settle before continuing —
    // an in-flight request left behind by an unmounted editor can otherwise
    // still be resolving when a later test's render starts.
    await waitFor(() => expect(screen.getByLabelText("Downtown")).toBeTruthy());

    fireEvent.click(screen.getByRole("combobox", { name: "Role" }));
    await waitFor(() => expect(screen.getByRole("option", { name: "Manager" })).toBeTruthy());
    fireEvent.click(screen.getByRole("option", { name: "Manager" }));
    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Ana" } });
    fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "Reyes" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: `Edit ${targetEmail}` })).toBeNull(),
    );
    await waitFor(() => {
      const updatedRow = screen.getByText(targetEmail).closest("tr")!;
      expect(within(updatedRow).getByText("Manager")).toBeTruthy();
    });

    await ownerDb.deleteFrom("UserStore").where("user_id", "=", targetId).execute();
    await ownerDb.deleteFrom("UserRole").where("user_id", "=", targetId).execute();
    await ownerDb.deleteFrom("User").where("id", "=", targetId).execute();
  });

  it("resets a User's password through the dialog and never retains it in the mutation cache", async () => {
    const targetId = randomUUID();
    const targetEmail = `reset-screen-${randomUUID()}@user.test`;
    await ownerDb
      .insertInto("User")
      .values({
        id: targetId,
        tenant_id: tenantId,
        email: targetEmail,
        password_hash: await hashPassword("irrelevant"),
        role: "cashier",
      })
      .execute();
    await ownerDb
      .insertInto("UserRole")
      .values({
        id: randomUUID(),
        tenant_id: tenantId,
        user_id: targetId,
        role: "cashier",
        effective_from: new Date(Date.now() - 60_000),
      })
      .execute();

    const { db, queryClient } = renderRoute({
      router,
      tenantId,
      userId: adminId,
      role: "admin",
      initialLocation: "/employees",
    });
    cleanup = async () => {
      await db.destroy();
      await ownerDb.deleteFrom("UserRole").where("user_id", "=", targetId).execute();
      await ownerDb.deleteFrom("User").where("id", "=", targetId).execute();
    };

    await waitFor(() => expect(screen.getByText(targetEmail)).toBeTruthy());
    const row = screen.getByText(targetEmail).closest("tr")!;
    const menu = await openRowMenu(row);
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Edit" }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: `Edit ${targetEmail}` })).toBeTruthy(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Reset password" }));
    // Named, because the editor is itself a dialog since record 049.
    const resetDialog = await waitFor(() =>
      screen.getByRole("dialog", { name: `Reset password for ${targetEmail}?` }),
    );
    fireEvent.change(screen.getByLabelText("New temporary password"), {
      target: { value: "a brand new password" },
    });
    fireEvent.click(within(resetDialog).getByRole("button", { name: "Reset password" }));

    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: `Reset password for ${targetEmail}?` }),
      ).toBeNull(),
    );

    const cachedVariables = queryClient
      .getMutationCache()
      .getAll()
      .map((mutation) => JSON.stringify(mutation.state.variables));
    expect(cachedVariables.some((entry) => entry.includes("a brand new password"))).toBe(false);
  });

  it("deactivates a User — stays listed, badged, with Reactivate its only action — then reactivates", async () => {
    const targetId = randomUUID();
    const targetEmail = `leaver-screen-${randomUUID()}@user.test`;
    await ownerDb
      .insertInto("User")
      .values({
        id: targetId,
        tenant_id: tenantId,
        email: targetEmail,
        password_hash: await hashPassword("irrelevant"),
        role: "cashier",
      })
      .execute();
    await ownerDb
      .insertInto("UserRole")
      .values({
        id: randomUUID(),
        tenant_id: tenantId,
        user_id: targetId,
        role: "cashier",
        effective_from: new Date(Date.now() - 60_000),
      })
      .execute();

    const { container, db } = renderRoute({
      router,
      tenantId,
      userId: adminId,
      role: "admin",
      initialLocation: "/employees",
    });
    cleanup = () => db.destroy();

    await waitFor(() => expect(screen.getByText(targetEmail)).toBeTruthy());
    const row = screen.getByText(targetEmail).closest("tr")!;
    let menu = await openRowMenu(row);
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Deactivate" }));

    await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
    expect(screen.getByText(`Deactivate ${targetEmail}?`)).toBeTruthy();
    expect(screen.getByRole("dialog").textContent?.toLowerCase()).not.toMatch(/delete|permanently/);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Deactivate" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => {
      const updatedRow = screen.getByText(targetEmail).closest("tr")!;
      expect(within(updatedRow).getByText("Deactivated")).toBeTruthy();
    });

    const deactivatedRow = screen.getByText(targetEmail).closest("tr")!;
    menu = await openRowMenu(deactivatedRow);
    expect(within(menu).queryByRole("menuitem", { name: "Edit" })).toBeNull();
    expect(within(menu).queryByRole("menuitem", { name: "Deactivate" })).toBeNull();
    const reactivateItem = within(menu).getByRole("menuitem", { name: "Reactivate" });
    expect(reactivateItem).toBeTruthy();
    fireEvent.click(reactivateItem);
    await waitFor(() => {
      const reactivatedRow = screen.getByText(targetEmail).closest("tr")!;
      expect(within(reactivatedRow).getByText("Active")).toBeTruthy();
    });

    await expectNoAxeViolations(container);

    await ownerDb.deleteFrom("UserRole").where("user_id", "=", targetId).execute();
    await ownerDb.deleteFrom("User").where("id", "=", targetId).execute();
  });

  it("keeps a deactivated User visible by default, searches by store name, and says so when nothing matches", async () => {
    const targetId = randomUUID();
    const targetEmail = `filtered-screen-${randomUUID()}@user.test`;
    await ownerDb
      .insertInto("User")
      .values({
        id: targetId,
        tenant_id: tenantId,
        email: targetEmail,
        first_name: "Juana",
        last_name: "dela Cruz",
        password_hash: await hashPassword("irrelevant"),
        role: "cashier",
        active: false,
      })
      .execute();
    await ownerDb
      .insertInto("UserStore")
      .values({
        id: randomUUID(),
        tenant_id: tenantId,
        user_id: targetId,
        store_id: storeId,
        assigned: true,
        effective_from: new Date(Date.now() - 60_000),
      })
      .execute();

    const { db } = renderRoute({
      router,
      tenantId,
      userId: adminId,
      role: "admin",
      initialLocation: "/employees",
    });
    cleanup = async () => {
      await db.destroy();
      await ownerDb.deleteFrom("UserStore").where("user_id", "=", targetId).execute();
      await ownerDb.deleteFrom("User").where("id", "=", targetId).execute();
    };

    await waitFor(() => expect(screen.getByText(targetEmail)).toBeTruthy());

    // Lifecycle is a column, not a filter: the deactivated User is here by
    // default, badged, so nobody disappears unasked (record 044 §4). A
    // single-store tenant earns no Store control (record 056 Q5's rule).
    const targetRow = screen.getByText(targetEmail).closest("tr")!;
    expect(within(targetRow).getByText("Deactivated")).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();

    // Search narrows to the one email, then to the person, then to the store
    // they work at — a person or a place, not just an address. Each assert
    // waits for the URL-driven filter to re-render the rows.
    fireEvent.change(screen.getByLabelText("Search employees"), { target: { value: targetEmail } });
    await waitFor(() => expect(screen.getAllByText(/@user\.test/).length).toBe(1));
    fireEvent.change(screen.getByLabelText("Search employees"), { target: { value: "juana" } });
    await waitFor(() => expect(screen.getAllByText(/@user\.test/).length).toBe(1));
    fireEvent.change(screen.getByLabelText("Search employees"), { target: { value: "downtown" } });
    await waitFor(() => expect(screen.getAllByText(/@user\.test/).length).toBe(1));
    fireEvent.change(screen.getByLabelText("Search employees"), {
      target: { value: "no-such-user" },
    });
    await waitFor(() => expect(screen.getByText("No employees match these filters")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    await waitFor(() => expect(screen.getByText(targetEmail)).toBeTruthy());
    expect(window.location.search).toContain("role=all");
    expect(window.location.search).toContain("q=");
    expect(window.location.search).toContain("page=1");
  });

  it("the caller's own row has no Deactivate action", async () => {
    const { db } = renderRoute({
      router,
      tenantId,
      userId: adminId,
      role: "admin",
      initialLocation: "/employees",
    });
    cleanup = () => db.destroy();

    await waitFor(() => expect(screen.getAllByText(/@user\.test/).length).toBeGreaterThan(0));
    const selfCell = Array.from(document.querySelectorAll("td")).find((cell) =>
      cell.textContent?.startsWith("users-screen-admin-"),
    );
    expect(selfCell).toBeTruthy();
    const selfRow = selfCell!.closest("tr")!;
    const menu = await openRowMenu(selfRow);
    expect(within(menu).queryByRole("menuitem", { name: "Deactivate" })).toBeNull();
    expect(within(menu).getByRole("menuitem", { name: "Edit" })).toBeTruthy();
  });

  it("self-demoting is refused server-side and shows an error, not a silent close", async () => {
    const { db } = renderRoute({
      router,
      tenantId,
      userId: adminId,
      role: "admin",
      initialLocation: "/employees",
    });
    cleanup = () => db.destroy();

    await waitFor(() => expect(screen.getAllByText(/@user\.test/).length).toBeGreaterThan(0));
    const selfCell = Array.from(document.querySelectorAll("td")).find((cell) =>
      cell.textContent?.startsWith("users-screen-admin-"),
    )!;
    const menu = await openRowMenu(selfCell.closest("tr")!);
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Edit" }));

    await waitFor(() => expect(screen.getByRole("combobox", { name: "Role" })).toBeTruthy());
    fireEvent.click(screen.getByRole("combobox", { name: "Role" }));
    await waitFor(() => expect(screen.getByRole("option", { name: "Manager" })).toBeTruthy());
    fireEvent.click(screen.getByRole("option", { name: "Manager" }));
    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Ana" } });
    fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "Reyes" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.getByRole("alert").textContent).toMatch(/Couldn.t save the employee/);
    // Still in the editor, not silently closed.
    expect(screen.getByRole("button", { name: "Save changes" })).toBeTruthy();
  });
});

describe("the Employees toolbar — role, store, and search filters", () => {
  let cleanup: (() => Promise<void>) | undefined;
  // The admin principal's row is wiped with the roster and restored here, so
  // the restored email is only known from this point on.
  let toolbarAdminEmail = "";
  // Present from the start of this describe (the single-store case is proven
  // in the admin describe above); the suite's own afterAll removes every
  // Store for the tenant regardless.
  const cubaoStoreId = randomUUID();

  beforeAll(async () => {
    // The admin describe above leaves its Users behind; wipe them so these
    // tests own the whole roster, then restore the admin (FK order:
    // UserStore, then UserRole, then User).
    await ownerDb.deleteFrom("UserStore").where("tenant_id", "=", tenantId).execute();
    await ownerDb.deleteFrom("UserRole").where("tenant_id", "=", tenantId).execute();
    await ownerDb.deleteFrom("User").where("tenant_id", "=", tenantId).execute();
    toolbarAdminEmail = `users-screen-toolbar-admin-${randomUUID()}@user.test`;
    await ownerDb
      .insertInto("User")
      .values({
        id: adminId,
        tenant_id: tenantId,
        email: toolbarAdminEmail,
        password_hash: await hashPassword("irrelevant"),
        role: "admin",
      })
      .execute();
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

  it("role pills split the roster by access, and the choice lands in the URL", async () => {
    // One of each role, none assigned to a Store — the Role pills are the
    // only way to tell them apart.
    const cashierId = randomUUID();
    const managerId = randomUUID();
    const cashierEmail = `roster-cashier-${randomUUID()}@user.test`;
    const managerEmail = `roster-manager-${randomUUID()}@user.test`;
    await ownerDb
      .insertInto("User")
      .values([
        {
          id: cashierId,
          tenant_id: tenantId,
          email: cashierEmail,
          password_hash: await hashPassword("irrelevant"),
          role: "cashier",
        },
        {
          id: managerId,
          tenant_id: tenantId,
          email: managerEmail,
          password_hash: await hashPassword("irrelevant"),
          role: "manager",
        },
      ])
      .execute();

    const { db } = renderRoute({
      router,
      tenantId,
      userId: adminId,
      role: "admin",
      initialLocation: "/employees",
    });
    cleanup = async () => {
      await db.destroy();
      await ownerDb.deleteFrom("User").where("id", "in", [cashierId, managerId]).execute();
    };

    await waitFor(() => expect(screen.getByText(cashierEmail)).toBeTruthy());
    expect(screen.getByText(managerEmail)).toBeTruthy();
    expect(screen.getByText(toolbarAdminEmail)).toBeTruthy();

    // Cashier only — the manager and the admin drop out, and the choice
    // lands in the URL so a shared link finds the same roster.
    fireEvent.click(screen.getByRole("button", { name: "Show cashier" }));
    await waitFor(() => expect(screen.queryByText(managerEmail)).toBeNull());
    expect(screen.getByText(cashierEmail)).toBeTruthy();
    expect(screen.queryByText(toolbarAdminEmail)).toBeNull();
    expect(window.location.search).toContain("role=cashier");

    fireEvent.click(screen.getByRole("button", { name: "Show manager" }));
    await waitFor(() => expect(screen.getByText(managerEmail)).toBeTruthy());
    expect(screen.queryByText(cashierEmail)).toBeNull();
    expect(screen.queryByText(toolbarAdminEmail)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Show all" }));
    await waitFor(() => expect(screen.getByText(toolbarAdminEmail)).toBeTruthy());
    expect(screen.getByText(cashierEmail)).toBeTruthy();
  });

  it("a second store earns the Store control, which filters by it", async () => {
    const cubaoUserId = randomUUID();
    const cubaoEmail = `cubao-roster-${randomUUID()}@user.test`;
    await ownerDb
      .insertInto("User")
      .values({
        id: cubaoUserId,
        tenant_id: tenantId,
        email: cubaoEmail,
        password_hash: await hashPassword("irrelevant"),
        role: "cashier",
      })
      .execute();
    await withTenantScope(ownerDb, tenantId, (db) =>
      db
        .insertInto("UserStore")
        .values({
          id: randomUUID(),
          tenant_id: tenantId,
          user_id: cubaoUserId,
          store_id: cubaoStoreId,
          assigned: true,
          effective_from: new Date(Date.now() - 60_000),
        })
        .execute(),
    );

    const { db } = renderRoute({
      router,
      tenantId,
      userId: adminId,
      role: "admin",
      initialLocation: "/employees",
    });
    cleanup = async () => {
      await db.destroy();
      await ownerDb.deleteFrom("UserStore").where("user_id", "=", cubaoUserId).execute();
      await ownerDb.deleteFrom("User").where("id", "=", cubaoUserId).execute();
    };

    // The stores query settles behind the roster — the control appears only
    // once it has, so the wait is on the control, not the rows.
    const storeSelect = await screen.findByRole("combobox", { name: "Store" });
    await waitFor(() => expect(screen.getByText(cubaoEmail)).toBeTruthy());

    fireEvent.click(storeSelect);
    await waitFor(() => expect(screen.getByRole("option", { name: "Cubao" })).toBeTruthy());
    fireEvent.click(screen.getByRole("option", { name: "Cubao" }));

    await waitFor(() => expect(screen.queryByText(toolbarAdminEmail)).toBeNull());
    expect(screen.getByText(cubaoEmail)).toBeTruthy();
    expect(window.location.search).toContain(`store=${cubaoStoreId}`);

    // Back to every store restores the roster.
    fireEvent.click(screen.getByRole("combobox", { name: "Store" }));
    await waitFor(() => expect(screen.getByRole("option", { name: "All stores" })).toBeTruthy());
    fireEvent.click(screen.getByRole("option", { name: "All stores" }));
    await waitFor(() => expect(screen.getByText(toolbarAdminEmail)).toBeTruthy());
  });

  it("search matches the store an employee works at, and a filtered URL lands on the same fleet on a fresh render", async () => {
    const downtownUserId = randomUUID();
    const downtownEmail = `downtown-roster-${randomUUID()}@user.test`;
    await ownerDb
      .insertInto("User")
      .values({
        id: downtownUserId,
        tenant_id: tenantId,
        email: downtownEmail,
        password_hash: await hashPassword("irrelevant"),
        role: "cashier",
      })
      .execute();
    await withTenantScope(ownerDb, tenantId, (db) =>
      db
        .insertInto("UserStore")
        .values({
          id: randomUUID(),
          tenant_id: tenantId,
          user_id: downtownUserId,
          store_id: storeId,
          assigned: true,
          effective_from: new Date(Date.now() - 60_000),
        })
        .execute(),
    );

    const { db } = renderRoute({
      router,
      tenantId,
      userId: adminId,
      role: "admin",
      initialLocation: "/employees?role=cashier&q=downtown",
    });
    cleanup = async () => {
      await db.destroy();
      await ownerDb.deleteFrom("UserStore").where("user_id", "=", downtownUserId).execute();
      await ownerDb.deleteFrom("User").where("id", "=", downtownUserId).execute();
    };

    // A fresh render at a filtered URL lands on the same fleet: only the one
    // Downtown cashier matches `role=cashier` + `q=downtown`, and the search
    // field reads the URL it came from.
    await waitFor(() => expect(screen.getByText(downtownEmail)).toBeTruthy());
    expect(screen.queryByText(toolbarAdminEmail)).toBeNull();
    expect((screen.getByLabelText("Search employees") as HTMLInputElement).value).toBe("downtown");

    // Widen to every role — the store-name search alone still finds her.
    fireEvent.click(screen.getByRole("button", { name: "Show all" }));
    await waitFor(() => expect(screen.queryByText(toolbarAdminEmail)).toBeNull());
    expect(screen.getByText(downtownEmail)).toBeTruthy();

    // Clearing the search restores the whole roster, and the URL follows.
    fireEvent.change(screen.getByLabelText("Search employees"), { target: { value: "" } });
    await waitFor(() => expect(screen.getByText(toolbarAdminEmail)).toBeTruthy());
    expect(window.location.search).toContain("role=all");
  });

  it("pages the roster server-side: ten rows per page, and Next lands on page 2 with the rest", async () => {
    const pageIds: string[] = [];
    for (let i = 1; i <= 12; i++) {
      const id = randomUUID();
      pageIds.push(id);
      await ownerDb
        .insertInto("User")
        .values({
          id,
          tenant_id: tenantId,
          email: `paged-roster-${i}-${randomUUID()}@user.test`,
          first_name: "Page",
          last_name: `User ${String(i).padStart(2, "0")}`,
          password_hash: await hashPassword("irrelevant"),
          role: "cashier",
        })
        .execute();
    }

    const { db } = renderRoute({
      router,
      tenantId,
      userId: adminId,
      role: "admin",
      initialLocation: "/employees",
    });
    cleanup = async () => {
      await db.destroy();
      await ownerDb.deleteFrom("User").where("id", "in", pageIds).execute();
    };

    // The roster is the admin + twelve named cashiers; the admin's blank
    // name sorts first, so page 1 is the admin + ten cashiers.
    await waitFor(() => expect(screen.getByText("Page User 01")).toBeTruthy());
    expect(screen.getByText("Page User 09")).toBeTruthy();
    expect(screen.queryByText("Page User 12")).toBeNull();
    expect(screen.getByText(/Showing 1–10 of \d+/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() => expect(screen.getByText("Page User 12")).toBeTruthy());
    expect(screen.queryByText("Page User 01")).toBeNull();
    expect(screen.getByText(/Showing 11–\d+ of \d+/)).toBeTruthy();
    expect(window.location.search).toContain("page=2");
  });

  it("sorting a column rides the URL and re-queries the server page", async () => {
    const zebraId = randomUUID();
    const alphaId = randomUUID();
    await ownerDb
      .insertInto("User")
      .values([
        {
          id: zebraId,
          tenant_id: tenantId,
          email: `sort-zebra-${randomUUID()}@user.test`,
          first_name: "Zoe",
          last_name: "Zebra",
          password_hash: await hashPassword("irrelevant"),
          role: "cashier",
        },
        {
          id: alphaId,
          tenant_id: tenantId,
          email: `sort-alpha-${randomUUID()}@user.test`,
          first_name: "Ava",
          last_name: "Alpha",
          password_hash: await hashPassword("irrelevant"),
          role: "cashier",
        },
      ])
      .execute();

    const { db } = renderRoute({
      router,
      tenantId,
      userId: adminId,
      role: "admin",
      initialLocation: "/employees",
    });
    cleanup = async () => {
      await db.destroy();
      await ownerDb.deleteFrom("User").where("id", "in", [zebraId, alphaId]).execute();
    };

    const rowTexts = () => screen.getAllByRole("row").map((row) => row.textContent ?? "");
    const indexOf = (texts: string[], marker: string) =>
      texts.findIndex((text) => text.includes(marker));
    // Name asc is the default: Ava before Zoe (the admin's blank name sorts
    // ahead of both, so relative order is the assertion, not row position).
    await waitFor(() => {
      const texts = rowTexts();
      expect(indexOf(texts, "sort-alpha")).toBeGreaterThanOrEqual(0);
      expect(indexOf(texts, "sort-alpha")).toBeLessThan(indexOf(texts, "sort-zebra"));
    });

    // One click on the Name header flips to descending, and the URL follows.
    fireEvent.click(screen.getByRole("button", { name: "Name" }));
    await waitFor(() => {
      const texts = rowTexts();
      expect(indexOf(texts, "sort-zebra")).toBeLessThan(indexOf(texts, "sort-alpha"));
    });
    expect(window.location.search).toContain("desc");
  });
});

describe("the Users screen — as a manager", () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await cleanup?.();
    cleanup = undefined;
  });

  it("sees itself and a coworker sharing its Store, both rows read-only: no actions column, no action buttons", async () => {
    const managerId = randomUUID();
    const coworkerId = randomUUID();
    const managerEmail = `manager-screen-${randomUUID()}@user.test`;
    const coworkerEmail = `coworker-screen-${randomUUID()}@user.test`;
    await ownerDb
      .insertInto("User")
      .values([
        {
          id: managerId,
          tenant_id: tenantId,
          email: managerEmail,
          password_hash: await hashPassword("irrelevant"),
          role: "manager",
        },
        {
          id: coworkerId,
          tenant_id: tenantId,
          email: coworkerEmail,
          password_hash: await hashPassword("irrelevant"),
          role: "cashier",
        },
      ])
      .execute();
    await withTenantScope(ownerDb, tenantId, (db) =>
      db
        .insertInto("UserStore")
        .values([
          {
            id: randomUUID(),
            tenant_id: tenantId,
            user_id: managerId,
            store_id: storeId,
            assigned: true,
            effective_from: new Date(Date.now() - 60_000),
          },
          {
            id: randomUUID(),
            tenant_id: tenantId,
            user_id: coworkerId,
            store_id: storeId,
            assigned: true,
            effective_from: new Date(Date.now() - 60_000),
          },
        ])
        .execute(),
    );

    const { container, db } = renderRoute({
      router,
      tenantId,
      userId: managerId,
      role: "manager",
      initialLocation: "/employees",
    });
    cleanup = async () => {
      await db.destroy();
      await ownerDb
        .deleteFrom("UserStore")
        .where("user_id", "in", [managerId, coworkerId])
        .execute();
      await ownerDb.deleteFrom("User").where("id", "in", [managerId, coworkerId]).execute();
    };

    await waitFor(() => expect(screen.getByText(managerEmail)).toBeTruthy());
    expect(screen.getByText(coworkerEmail)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Add employee" })).toBeNull();
    expect(screen.queryByRole("columnheader", { name: /Actions/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Edit/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Deactivate/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Reactivate/ })).toBeNull();

    await expectNoAxeViolations(container);
  });

  it("has no Add user button, no actions column at all, and shows the manager-only empty state", async () => {
    // No matching User row for this principal sees nobody at all — only a
    // manager can reach this empty state (record 044 §3).
    const { container, db } = renderRoute({
      router,
      tenantId,
      userId: randomUUID(),
      role: "manager",
      initialLocation: "/employees",
    });
    cleanup = () => db.destroy();

    await waitFor(() => expect(screen.getByRole("heading", { name: "Employees" })).toBeTruthy());
    expect(screen.queryByRole("button", { name: "Add employee" })).toBeNull();

    await waitFor(() => expect(screen.getByText("No employees to show")).toBeTruthy());
    expect(screen.queryByRole("columnheader", { name: /Actions/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Edit/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Deactivate/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Reactivate/ })).toBeNull();

    await expectNoAxeViolations(container);
  });
});
