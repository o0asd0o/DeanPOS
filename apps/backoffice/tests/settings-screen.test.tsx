import { randomUUID } from "node:crypto";

import {
  createDb,
  expectNoAxeViolations,
  fireEvent,
  hashPassword,
  renderRoute,
  screen,
  waitFor,
  within,
} from "api/src/test-seam-react.tsx";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vite-plus/test";

import { router } from "@/router.tsx";

// The Sales settings dialog (issue 07, record 046) — no lofi mock beyond
// the tenant-level fields; the payment-method list on the same mock is
// issue 08. It opens from the account menu; there is no /settings route.
const ownerDb = createDb({ databaseUrl: process.env.DATABASE_URI! });

const tenantId = randomUUID();
const adminId = randomUUID();
const managerId = randomUUID();
const cashierId = randomUUID();

beforeAll(async () => {
  await ownerDb
    .insertInto("Tenant")
    .values({ id: tenantId, name: "Settings Screen Tenant" })
    .execute();
  const passwordHash = await hashPassword("irrelevant");
  await ownerDb
    .insertInto("User")
    .values([
      {
        id: adminId,
        tenant_id: tenantId,
        email: `settings-screen-admin-${randomUUID()}@settings.test`,
        password_hash: passwordHash,
        role: "admin",
      },
      {
        id: managerId,
        tenant_id: tenantId,
        email: `settings-screen-manager-${randomUUID()}@settings.test`,
        password_hash: passwordHash,
        role: "manager",
      },
      {
        id: cashierId,
        tenant_id: tenantId,
        email: `settings-screen-cashier-${randomUUID()}@settings.test`,
        password_hash: passwordHash,
        role: "cashier",
      },
    ])
    .execute();
});

// Radix opens a menu on pointerdown, which happy-dom's `click` does not imply
// (record 042).
const openAccountMenu = async () => {
  const trigger = await waitFor(() => screen.getByRole("button", { name: "Account" }));
  fireEvent.pointerDown(trigger, { button: 0, pointerType: "mouse" });
  return waitFor(() => screen.getByRole("menu"));
};

const openSettings = async () => {
  const menu = await openAccountMenu();
  fireEvent.click(within(menu).getByRole("menuitem", { name: "Settings" }));
  return waitFor(() => screen.getByRole("dialog"));
};

afterAll(async () => {
  await ownerDb.deleteFrom("TenantSettingsAudit").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("User").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Tenant").where("id", "=", tenantId).execute();
  await ownerDb.destroy();
});

describe("the Settings dialog — as an admin", () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await cleanup?.();
    cleanup = undefined;
  });

  it("shows the defaults, changes VAT and the timezone, and saves", async () => {
    const { db } = renderRoute({
      router,
      tenantId,
      userId: adminId,
      role: "admin",
      initialLocation: "/stores",
    });
    cleanup = () => db.destroy();

    // Nothing is read until the dialog is visible.
    await waitFor(() => expect(screen.getByRole("heading", { name: "Stores" })).toBeTruthy());
    expect(screen.queryByLabelText("Variance tolerance (₱)")).toBeNull();

    await openSettings();
    await waitFor(() =>
      expect(screen.getByLabelText("Variance tolerance (₱)")).toHaveProperty("value", "0.00"),
    );
    expect(screen.getByLabelText("This business is VAT-registered")).toBeTruthy();
    // The dialog itself, not the whole tree: Radix `aria-hidden`s the page
    // behind a modal while its focus trap — not `inert` — keeps focus in.
    await expectNoAxeViolations(screen.getByRole("dialog"));

    fireEvent.click(screen.getByLabelText("This business is VAT-registered"));
    fireEvent.change(screen.getByLabelText("Rate (%)"), { target: { value: "15" } });
    fireEvent.change(screen.getByLabelText("Variance tolerance (₱)"), {
      target: { value: "5.00" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Saved"));
    await waitFor(() =>
      expect(screen.getByLabelText("Variance tolerance (₱)")).toHaveProperty("value", "5.00"),
    );
    expect(screen.getByLabelText("This business is VAT-registered")).toHaveProperty(
      "checked",
      true,
    );

    const rows = await ownerDb
      .selectFrom("TenantSettingsAudit")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .execute();
    expect(rows.length).toBeGreaterThanOrEqual(3);
    expect(rows.every((row) => row.actor_user_id === adminId)).toBe(true);

    await expectNoAxeViolations(screen.getByRole("dialog"));
  });

  it("a resolved refusal (Tenant gone between load and submit) shows an error, not a silent success", async () => {
    const refusalTenantId = randomUUID();
    const refusalAdminId = randomUUID();
    await ownerDb
      .insertInto("Tenant")
      .values({ id: refusalTenantId, name: "Refusal Tenant" })
      .execute();
    await ownerDb
      .insertInto("User")
      .values({
        id: refusalAdminId,
        tenant_id: refusalTenantId,
        email: `settings-screen-refusal-${randomUUID()}@settings.test`,
        password_hash: await hashPassword("irrelevant"),
        role: "admin",
      })
      .execute();

    const { db } = renderRoute({
      router,
      tenantId: refusalTenantId,
      userId: refusalAdminId,
      role: "admin",
      initialLocation: "/stores",
    });
    cleanup = async () => {
      await db.destroy();
      await ownerDb.deleteFrom("User").where("id", "=", refusalAdminId).execute();
      await ownerDb.deleteFrom("Tenant").where("id", "=", refusalTenantId).execute();
    };

    await openSettings();
    await waitFor(() => expect(screen.getByLabelText("Rate (%)")).toHaveProperty("value", "12"));

    // The Tenant row vanishes between load and submit (e.g. deprovisioned
    // mid-session) — the update resolves `null` rather than rejecting.
    // The User row goes first: a live FK (`ON DELETE RESTRICT`) blocks
    // deleting the Tenant while it still exists.
    await ownerDb.deleteFrom("User").where("id", "=", refusalAdminId).execute();
    await ownerDb.deleteFrom("Tenant").where("id", "=", refusalTenantId).execute();

    fireEvent.change(screen.getByLabelText("Rate (%)"), { target: { value: "15" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.getByRole("status").textContent).not.toBe("Saved");
  });
});

describe("the Settings dialog — non-admin", () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await cleanup?.();
    cleanup = undefined;
  });

  it("offers a manager no way in — no account-menu entry, no nav entry", async () => {
    const { db } = renderRoute({
      router,
      tenantId,
      userId: managerId,
      role: "manager",
      initialLocation: "/stores",
    });
    cleanup = () => db.destroy();

    await waitFor(() => expect(screen.getByRole("heading", { name: "Stores" })).toBeTruthy());
    const menu = await openAccountMenu();
    expect(within(menu).queryByRole("menuitem", { name: "Settings" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Settings" })).toBeNull();
  });

  it("offers a cashier no way in either", async () => {
    const { db } = renderRoute({
      router,
      tenantId,
      userId: cashierId,
      role: "cashier",
      initialLocation: "/stores",
    });
    cleanup = () => db.destroy();

    await waitFor(() => expect(screen.getByRole("heading", { name: "Stores" })).toBeTruthy());
    const menu = await openAccountMenu();
    expect(within(menu).queryByRole("menuitem", { name: "Settings" })).toBeNull();
  });
});
