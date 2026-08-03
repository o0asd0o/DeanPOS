import { randomUUID } from "node:crypto";

import {
  createDb,
  expectNoAxeViolations,
  fireEvent,
  hashPassword,
  renderRoute,
  screen,
  waitFor,
} from "api/src/test-seam-react.tsx";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vite-plus/test";

import { router } from "@/router.tsx";

// The Sales settings screen (issue 07, record 046) — no lofi mock beyond
// the tenant-level fields; the payment-method list on the same mock is
// issue 08.
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

afterAll(async () => {
  await ownerDb.deleteFrom("TenantSettingsAudit").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("User").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Tenant").where("id", "=", tenantId).execute();
  await ownerDb.destroy();
});

describe("the Settings screen — as an admin", () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await cleanup?.();
    cleanup = undefined;
  });

  it("shows the defaults, changes VAT and the timezone, and saves", async () => {
    const { container, db } = renderRoute({
      router,
      tenantId,
      userId: adminId,
      role: "admin",
      initialLocation: "/settings",
    });
    cleanup = () => db.destroy();

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Sales settings" })).toBeTruthy(),
    );
    expect(screen.getByLabelText("Variance tolerance (₱)")).toHaveProperty("value", "0.00");
    expect(screen.getByLabelText("This business is VAT-registered")).toBeTruthy();
    await expectNoAxeViolations(container);

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

    await expectNoAxeViolations(container);
  });
});

describe("the Settings screen — non-admin", () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await cleanup?.();
    cleanup = undefined;
  });

  it("a manager navigating directly to /settings is refused, server-side", async () => {
    const { db } = renderRoute({
      router,
      tenantId,
      userId: managerId,
      role: "manager",
      initialLocation: "/settings",
    });
    cleanup = () => db.destroy();

    await waitFor(() => expect(screen.getByText("That page doesn’t exist.")).toBeTruthy());
    expect(screen.queryByRole("heading", { name: "Sales settings" })).toBeNull();
  });

  it("a cashier navigating directly to /settings is refused, server-side", async () => {
    const { db } = renderRoute({
      router,
      tenantId,
      userId: cashierId,
      role: "cashier",
      initialLocation: "/settings",
    });
    cleanup = () => db.destroy();

    await waitFor(() => expect(screen.getByText("That page doesn’t exist.")).toBeTruthy());
  });

  it("has no Settings entry in the nav for a manager", async () => {
    const { db } = renderRoute({
      router,
      tenantId,
      userId: managerId,
      role: "manager",
      initialLocation: "/stores",
    });
    cleanup = () => db.destroy();

    await waitFor(() => expect(screen.getByRole("heading", { name: "Stores" })).toBeTruthy());
    await waitFor(() => expect(screen.queryByText("Settings")).toBeNull());
  });

  it("has a Settings entry in the nav for an admin", async () => {
    const { db } = renderRoute({
      router,
      tenantId,
      userId: adminId,
      role: "admin",
      initialLocation: "/stores",
    });
    cleanup = () => db.destroy();

    await waitFor(() => expect(screen.getByRole("link", { name: "Settings" })).toBeTruthy());
  });
});
