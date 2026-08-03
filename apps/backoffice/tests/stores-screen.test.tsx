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

// The Store management screen (records 038, 039, 040) — no lofi mock, these
// records are the contract.
const ownerDb = createDb({ databaseUrl: process.env.DATABASE_URI! });

const tenantId = randomUUID();
const adminId = randomUUID();

beforeAll(async () => {
  await ownerDb
    .insertInto("Tenant")
    .values({ id: tenantId, name: "Stores Screen Tenant" })
    .execute();
  const passwordHash = await hashPassword("irrelevant");
  await ownerDb
    .insertInto("User")
    .values({
      id: adminId,
      tenant_id: tenantId,
      email: `stores-screen-admin-${randomUUID()}@store.test`,
      password_hash: passwordHash,
      role: "admin",
    })
    .execute();
});

afterAll(async () => {
  await ownerDb.deleteFrom("UserStore").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Store").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("User").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Tenant").where("id", "=", tenantId).execute();
  await ownerDb.destroy();
});

describe("the Stores screen — as an admin", () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await cleanup?.();
    cleanup = undefined;
  });

  it("creates a Store, lists it with its settings, and shows no delete anywhere", async () => {
    const { container, db } = renderRoute({
      router,
      tenantId,
      userId: adminId,
      role: "admin",
      initialLocation: "/stores",
    });
    cleanup = () => db.destroy();

    await waitFor(() => expect(screen.getByRole("heading", { name: "Stores" })).toBeTruthy());
    expect(screen.getByRole("button", { name: "Add store" })).toBeTruthy();
    await expectNoAxeViolations(container);

    fireEvent.click(screen.getByRole("button", { name: "Add store" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "New store" })).toBeTruthy());
    expect(document.activeElement).toBe(screen.getByLabelText("Name"));

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Downtown" } });
    fireEvent.change(screen.getByLabelText("Business-day start"), { target: { value: "02:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Add label" }));
    fireEvent.change(screen.getByLabelText("Table label 1"), { target: { value: "Patio" } });

    fireEvent.click(screen.getByRole("button", { name: "Create store" }));

    await waitFor(() => expect(screen.queryByRole("heading", { name: "New store" })).toBeNull());
    await waitFor(() => expect(screen.getByText("Downtown")).toBeTruthy());

    const row = screen.getByText("Downtown").closest("tr")!;
    expect(within(row).getByText("02:00")).toBeTruthy();
    expect(within(row).getByText("1")).toBeTruthy();
    expect(within(row).getByText("Active")).toBeTruthy();

    expect(container.textContent?.toLowerCase()).not.toMatch(/delete|permanently/);
    await expectNoAxeViolations(container);
  });

  it("the reorder control: focus follows the moving row, not the position (record 039's critical check)", async () => {
    const { db } = renderRoute({
      router,
      tenantId,
      userId: adminId,
      role: "admin",
      initialLocation: "/stores",
    });
    cleanup = () => db.destroy();

    await waitFor(() => expect(screen.getByRole("heading", { name: "Stores" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Add store" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "New store" })).toBeTruthy());

    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByRole("button", { name: "Add label" }));
    }
    const inputs = screen.getAllByLabelText(/Table label \d/) as HTMLInputElement[];
    ["A", "B", "C", "D"].forEach((value, i) => fireEvent.change(inputs[i]!, { target: { value } }));

    // Native <button>, so activation is the platform's — click and key both
    // land on the same onClick. What's asserted here is focus identity
    // across a re-render (record 039's critical check).
    const row1Down = screen.getByRole("button", { name: "Move label 1 down" }) as HTMLButtonElement;
    expect(row1Down.tagName).toBe("BUTTON");
    row1Down.focus();
    expect(document.activeElement).toBe(row1Down);

    fireEvent.click(row1Down);
    await waitFor(() => expect(row1Down.getAttribute("aria-label")).toBe("Move label 2 down"));
    expect(document.activeElement).toBe(row1Down);

    fireEvent.click(row1Down);
    await waitFor(() => expect(row1Down.getAttribute("aria-label")).toBe("Move label 3 down"));
    expect(document.activeElement).toBe(row1Down);

    fireEvent.click(row1Down);
    await waitFor(() => expect(row1Down.getAttribute("aria-label")).toBe("Move label 4 down"));
    expect(document.activeElement).toBe(row1Down);
    expect(row1Down.getAttribute("aria-disabled")).toBe("true");
    expect(row1Down.disabled).toBe(false);

    // Nothing else stands between the user and a fifth move but the
    // early-return guard — prove it holds.
    fireEvent.click(row1Down);
    const reorderedInputs = screen.getAllByLabelText(/Table label \d/) as HTMLInputElement[];
    expect(reorderedInputs.map((input) => input.value)).toStrictEqual(["B", "C", "D", "A"]);
  });

  it("deactivates a Store — it stays listed, badged, readable, with Reactivate its only action — then reactivates it", async () => {
    const localStoreId = randomUUID();
    await withTenantScope(ownerDb, tenantId, (db) =>
      db
        .insertInto("Store")
        .values({ id: localStoreId, tenant_id: tenantId, name: "Closing Soon" })
        .execute(),
    );

    const { container, db } = renderRoute({
      router,
      tenantId,
      userId: adminId,
      role: "admin",
      initialLocation: "/stores",
    });
    cleanup = () => db.destroy();

    await waitFor(() => expect(screen.getByText("Closing Soon")).toBeTruthy());
    const row = screen.getByText("Closing Soon").closest("tr")!;
    fireEvent.click(within(row).getByRole("button", { name: /^Deactivate/ }));

    await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
    expect(screen.getByText("Deactivate Closing Soon?")).toBeTruthy();
    // Record 041's copy, asserted with the dialog open — the word "delete"
    // must never appear (038's invariant).
    expect(
      screen.getByText(
        "This store stops being offered for new work, its past sales stay attributed to it, and Reactivate brings it back",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("dialog").textContent?.toLowerCase()).not.toMatch(/delete|permanently/);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Deactivate" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => {
      const updatedRow = screen.getByText("Closing Soon").closest("tr")!;
      expect(within(updatedRow).getByText("Deactivated")).toBeTruthy();
    });

    const deactivatedRow = screen.getByText("Closing Soon").closest("tr")!;
    expect(within(deactivatedRow).queryByRole("button", { name: /^Edit/ })).toBeNull();
    expect(within(deactivatedRow).queryByRole("button", { name: /^Deactivate/ })).toBeNull();
    expect(within(deactivatedRow).getByRole("button", { name: /^Reactivate/ })).toBeTruthy();

    await expectNoAxeViolations(container);

    fireEvent.click(within(deactivatedRow).getByRole("button", { name: /^Reactivate/ }));
    await waitFor(() => {
      const reactivatedRow = screen.getByText("Closing Soon").closest("tr")!;
      expect(within(reactivatedRow).getByText("Active")).toBeTruthy();
    });

    await ownerDb.deleteFrom("Store").where("id", "=", localStoreId).execute();
  });

  it("announces two consecutive identical events, not just the first (finding 4)", async () => {
    const { db } = renderRoute({
      router,
      tenantId,
      userId: adminId,
      role: "admin",
      initialLocation: "/stores",
    });
    cleanup = () => db.destroy();

    await waitFor(() => expect(screen.getByRole("heading", { name: "Stores" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Add store" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "New store" })).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "Add label" }));
    fireEvent.click(screen.getByRole("button", { name: "Add label" }));

    // Two removals in a row produce the identical message "Label removed"
    // — each must still land in the live region as a fresh DOM mutation.
    fireEvent.click(screen.getByRole("button", { name: "Remove label 2" }));
    const regions = () => screen.getAllByRole("status").filter((el) => el.textContent);
    await waitFor(() =>
      expect(regions().map((el) => el.textContent)).toStrictEqual(["Label removed"]),
    );
    const firstRegion = regions()[0]!;

    fireEvent.click(screen.getByRole("button", { name: "Remove label 1" }));
    await waitFor(() => {
      const active = regions();
      expect(active.map((el) => el.textContent)).toStrictEqual(["Label removed"]);
      expect(active[0]).not.toBe(firstRegion);
    });
  });
});
