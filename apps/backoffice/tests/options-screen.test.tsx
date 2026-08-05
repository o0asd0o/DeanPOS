import { randomUUID } from "node:crypto";

import {
  cleanup as unmountAll,
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

const ownerDb = createDb({ databaseUrl: process.env.DATABASE_URI! });

const tenantId = randomUUID();
const managerId = randomUUID();
const cashierId = randomUUID();

beforeAll(async () => {
  await ownerDb
    .insertInto("Tenant")
    .values({ id: tenantId, name: "Options Screen Tenant" })
    .execute();
  const passwordHash = await hashPassword("irrelevant");
  await ownerDb
    .insertInto("User")
    .values([
      {
        id: managerId,
        tenant_id: tenantId,
        email: `options-screen-mgr-${randomUUID()}@test.local`,
        password_hash: passwordHash,
        role: "manager",
      },
      {
        id: cashierId,
        tenant_id: tenantId,
        email: `options-screen-cash-${randomUUID()}@test.local`,
        password_hash: passwordHash,
        role: "cashier",
      },
    ])
    .execute();
});

afterAll(async () => {
  await ownerDb.deleteFrom("Modifier").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("ModifierGroup").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("User").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Tenant").where("id", "=", tenantId).execute();
  await ownerDb.destroy();
});

describe("the Options screen", () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await cleanup?.();
    cleanup = undefined;
    unmountAll();
    await ownerDb.deleteFrom("Modifier").where("tenant_id", "=", tenantId).execute();
    await ownerDb.deleteFrom("ModifierGroup").where("tenant_id", "=", tenantId).execute();
  });

  it("lists groups with Linked to from the query, delta radios + affix, live regions, axe clean", async () => {
    const { container, db } = renderRoute({
      router,
      tenantId,
      userId: managerId,
      role: "manager",
      initialLocation: "/add-ons",
    });
    cleanup = () => db.destroy();

    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1, name: "Options" })).toBeTruthy(),
    );

    expect(screen.getAllByRole("link", { name: "Options" }).length).toBeGreaterThan(0);

    await waitFor(() => expect(screen.queryByText("Loading…")).toBeNull());
    await expectNoAxeViolations(container);

    fireEvent.click(screen.getByRole("button", { name: "Add modifier group" }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "New modifier group" })).toBeTruthy(),
    );

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Size" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.getByText("Size")).toBeTruthy());
    await waitFor(() => {
      const statuses = screen.getAllByRole("status").map((el) => el.textContent ?? "");
      expect(statuses.some((t) => t.includes("Group created"))).toBe(true);
    });

    const row = screen.getByText("Size").closest("tr");
    expect(row).toBeTruthy();
    expect(within(row!).getByText("0")).toBeTruthy();

    fireEvent.click(within(row!).getByRole("button", { name: "Modifier" }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /New modifier/i })).toBeTruthy(),
    );

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Half" } });
    fireEvent.click(screen.getByRole("radio", { name: "Multiplier" }));
    expect(screen.getByText("×")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Rate"), { target: { value: "0.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.getByText("Half")).toBeTruthy());
    await waitFor(() => expect(screen.getByText("×0.5")).toBeTruthy());

    const live = screen.getAllByRole("status").map((el) => el.textContent ?? "");
    expect(live.some((t) => t.includes("Modifier created"))).toBe(true);

    const rows = await ownerDb
      .selectFrom("ModifierGroup")
      .select(["name"])
      .where("tenant_id", "=", tenantId)
      .where("name", "=", "Size")
      .execute();
    expect(rows).toHaveLength(1);

    await expectNoAxeViolations(container);
  }, 20_000);

  it("cashier cannot see Add modifier group", async () => {
    const { db } = renderRoute({
      router,
      tenantId,
      userId: cashierId,
      role: "cashier",
      initialLocation: "/add-ons",
    });
    cleanup = () => db.destroy();

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Add modifier group" })).toBeNull();
    });
  });
});
