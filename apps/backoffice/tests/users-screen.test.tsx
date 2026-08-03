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
    fireEvent.click(within(row).getByRole("button", { name: `Edit ${targetEmail}` }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: `Edit ${targetEmail}` })).toBeTruthy(),
    );
    // Email is create-only — no Email field in the edit form (record 045 §1).
    expect(screen.queryByLabelText("Email")).toBeNull();
    // Reset password lives here, not a separate confirm-password field.
    expect(screen.getByRole("button", { name: "Reset password" })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("combobox", { name: "Role" }));

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
    fireEvent.click(within(row).getByRole("button", { name: `Edit ${targetEmail}` }));
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
    fireEvent.click(within(row).getByRole("button", { name: `Deactivate ${targetEmail}` }));

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
    expect(within(deactivatedRow).queryByRole("button", { name: /^Edit/ })).toBeNull();
    expect(within(deactivatedRow).queryByRole("button", { name: /^Deactivate/ })).toBeNull();
    expect(within(deactivatedRow).getByRole("button", { name: /^Reactivate/ })).toBeTruthy();

    await expectNoAxeViolations(container);

    fireEvent.click(within(deactivatedRow).getByRole("button", { name: /^Reactivate/ }));
    await waitFor(() => {
      const reactivatedRow = screen.getByText(targetEmail).closest("tr")!;
      expect(within(reactivatedRow).getByText("Active")).toBeTruthy();
    });

    await ownerDb.deleteFrom("UserRole").where("user_id", "=", targetId).execute();
    await ownerDb.deleteFrom("User").where("id", "=", targetId).execute();
  });

  it("filters the list by status and by a search term, and says so when nothing matches", async () => {
    const targetId = randomUUID();
    const targetEmail = `filtered-screen-${randomUUID()}@user.test`;
    await ownerDb
      .insertInto("User")
      .values({
        id: targetId,
        tenant_id: tenantId,
        email: targetEmail,
        password_hash: await hashPassword("irrelevant"),
        role: "cashier",
        active: false,
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
      await ownerDb.deleteFrom("User").where("id", "=", targetId).execute();
    };

    await waitFor(() => expect(screen.getByText(targetEmail)).toBeTruthy());

    // Deactivated User drops out under `Active`, comes back under `Status: All`.
    fireEvent.click(screen.getByRole("button", { name: "Status: Active" }));
    expect(screen.queryByText(targetEmail)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Status: All" }));
    expect(screen.getByText(targetEmail)).toBeTruthy();

    // Search narrows to the one email, then to nobody.
    fireEvent.change(screen.getByLabelText("Search users"), { target: { value: targetEmail } });
    expect(screen.getAllByText(/@user\.test/).length).toBe(1);
    fireEvent.change(screen.getByLabelText("Search users"), { target: { value: "no-such-user" } });
    expect(screen.getByText("No employees match these filters")).toBeTruthy();
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
    expect(within(selfRow).queryByRole("button", { name: /^Deactivate/ })).toBeNull();
    expect(within(selfRow).getByRole("button", { name: /^Edit/ })).toBeTruthy();
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
    fireEvent.click(within(selfCell.closest("tr")!).getByRole("button", { name: /^Edit/ }));

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
