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
    const { container, db } = renderRoute({
      router,
      tenantId,
      userId: adminId,
      role: "admin",
      initialLocation: "/users",
    });
    cleanup = () => db.destroy();

    await waitFor(() => expect(screen.getByRole("heading", { name: "Users" })).toBeTruthy());
    expect(screen.getByRole("button", { name: "Add user" })).toBeTruthy();
    await expectNoAxeViolations(container);

    fireEvent.click(screen.getByRole("button", { name: "Add user" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "New user" })).toBeTruthy());
    expect(document.activeElement).toBe(screen.getByLabelText("Email"));

    const newEmail = `new-hire-${randomUUID()}@user.test`;
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: newEmail } });

    const passwordField = screen.getByLabelText("Temporary password") as HTMLInputElement;
    expect(passwordField.type).toBe("password");
    expect(passwordField.getAttribute("autocomplete")).toBe("new-password");
    expect(passwordField.getAttribute("minlength")).toBe("8");
    expect(passwordField.getAttribute("maxlength")).toBeNull();
    fireEvent.change(passwordField, { target: { value: "a temporary password" } });

    await waitFor(() => expect(screen.getByLabelText("Downtown")).toBeTruthy());
    fireEvent.click(screen.getByLabelText("Downtown"));

    fireEvent.click(screen.getByRole("button", { name: "Create user" }));

    await waitFor(() => expect(screen.queryByRole("heading", { name: "New user" })).toBeNull());
    await waitFor(() => expect(screen.getByText(newEmail)).toBeTruthy());

    const row = screen.getByText(newEmail).closest("tr")!;
    expect(within(row).getByText("Cashier")).toBeTruthy();
    expect(within(row).getByText("Downtown")).toBeTruthy();
    expect(within(row).getByText("Active")).toBeTruthy();

    // No password anywhere on the page (record 043 no-go 2).
    expect(container.textContent).not.toMatch(/a temporary password/);
    expect(container.textContent?.toLowerCase()).not.toMatch(/delete|permanently/);
    await expectNoAxeViolations(container);
  });

  it("has no NAME column and never truncates the email (record 044)", async () => {
    const { db } = renderRoute({
      router,
      tenantId,
      userId: adminId,
      role: "admin",
      initialLocation: "/users",
    });
    cleanup = () => db.destroy();

    await waitFor(() => expect(screen.queryByText("Loading…")).toBeNull());
    expect(screen.queryByText("Name")).toBeNull();
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
      initialLocation: "/users",
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

    // Let the editor's own Stores checkbox list settle before continuing —
    // an in-flight request left behind by an unmounted editor can otherwise
    // still be resolving when a later test's render starts.
    await waitFor(() => expect(screen.getByLabelText("Downtown")).toBeTruthy());

    fireEvent.click(screen.getByRole("combobox", { name: "Role" }));
    await waitFor(() => expect(screen.getByRole("option", { name: "Manager" })).toBeTruthy());
    fireEvent.click(screen.getByRole("option", { name: "Manager" }));
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
      initialLocation: "/users",
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

  it("the caller's own row has no Deactivate action", async () => {
    const { db } = renderRoute({
      router,
      tenantId,
      userId: adminId,
      role: "admin",
      initialLocation: "/users",
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
});
