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
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

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
  await ownerDb
    .deleteFrom("UserStore")
    .where("tenant_id", "=", tenantId)
    .execute();
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
    vi.restoreAllMocks();
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

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Stores" })).toBeTruthy(),
    );
    expect(screen.getByRole("button", { name: "Add store" })).toBeTruthy();
    await expectNoAxeViolations(container);

    fireEvent.click(screen.getByRole("button", { name: "Add store" }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "New store" })).toBeTruthy(),
    );
    expect(document.activeElement).toBe(screen.getByLabelText("Name"));

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Downtown" },
    });
    fireEvent.change(screen.getByLabelText("Business-day start"), {
      target: { value: "02:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add label" }));
    fireEvent.change(screen.getByLabelText("Table label 1"), {
      target: { value: "Patio" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Create store" }));

    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "New store" })).toBeNull(),
    );
    await waitFor(() => expect(screen.getByText("Downtown")).toBeTruthy());

    const row = screen.getByText("Downtown").closest("tr")!;
    expect(within(row).getByText("02:00")).toBeTruthy();
    expect(within(row).getByText("1")).toBeTruthy();
    expect(within(row).getByText("Active")).toBeTruthy();

    expect(container.textContent?.toLowerCase()).not.toMatch(
      /delete|permanently/,
    );
    await expectNoAxeViolations(container);
  });

  it("the reorder control: drag-to-reorder keeps focus on the lifted row (record 039's critical check)", async () => {
    const { db } = renderRoute({
      router,
      tenantId,
      userId: adminId,
      role: "admin",
      initialLocation: "/stores",
    });
    cleanup = () => db.destroy();

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Stores" })).toBeTruthy(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Add store" }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "New store" })).toBeTruthy(),
    );

    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByRole("button", { name: "Add label" }));
    }
    const inputs = screen.getAllByLabelText(
      /Table label \d/,
    ) as HTMLInputElement[];
    ["A", "B", "C", "D"].forEach((value, i) =>
      fireEvent.change(inputs[i]!, { target: { value } }),
    );

    // dnd-kit resolves drag targets from measured layout, and happy-dom
    // reports every rect as zero — pin the four rows to fixed stacked rects
    // keyed by their input value so the drag lands on real targets.
    const rowValues = () =>
      Array.from(
        document.querySelectorAll<HTMLInputElement>(
          "input[aria-label^='Table label']",
        ),
      ).map((input) => input.value);
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      function (this: Element) {
        const row = this.closest("[data-label-row]");
        if (row) {
          const index = rowValues().indexOf(
            row.querySelector("input")?.value ?? "",
          );
          const top = index * 40;
          return {
            x: 0,
            y: top,
            top,
            left: 0,
            right: 120,
            bottom: top + 40,
            width: 120,
            height: 40,
            toJSON: () => ({}),
          } as DOMRect;
        }
        return {
          x: 0,
          y: 0,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: 0,
          height: 0,
          toJSON: () => ({}),
        } as DOMRect;
      },
    );

    // The handle is a native <button>, so dnd-kit's keyboard sensor lifts it
    // with Space and steps it with the arrow keys. What's asserted here is
    // focus identity across the reorder (record 039's critical check): the
    // same handle keeps focus and moves with its row.
    const handle = screen.getByRole("button", {
      name: "Drag label 1",
    }) as HTMLButtonElement;
    expect(handle.tagName).toBe("BUTTON");
    handle.focus();
    expect(document.activeElement).toBe(handle);

    fireEvent.keyDown(handle, { key: " ", code: "Space" });
    await waitFor(() =>
      expect(handle.getAttribute("aria-pressed")).toBe("true"),
    );
    fireEvent.keyDown(handle, { key: "ArrowDown", code: "ArrowDown" });
    fireEvent.keyDown(handle, { key: "ArrowDown", code: "ArrowDown" });
    fireEvent.keyDown(handle, { key: "ArrowDown", code: "ArrowDown" });
    fireEvent.keyDown(handle, { key: " ", code: "Space" });

    const reorderedInputs = screen.getAllByLabelText(
      /Table label \d/,
    ) as HTMLInputElement[];
    await waitFor(() =>
      expect(reorderedInputs.map((input) => input.value)).toStrictEqual([
        "B",
        "C",
        "D",
        "A",
      ]),
    );
    // Same element still focused, now wearing its new position (039 §1).
    expect(document.activeElement).toBe(handle);
    expect(handle.getAttribute("aria-label")).toBe("Drag label 4");
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
    expect(screen.getByRole("dialog").textContent?.toLowerCase()).not.toMatch(
      /delete|permanently/,
    );
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Deactivate",
      }),
    );

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => {
      const updatedRow = screen.getByText("Closing Soon").closest("tr")!;
      expect(within(updatedRow).getByText("Deactivated")).toBeTruthy();
    });
    // Every mutation says what happened — the wiring, not just the copy.
    expect(screen.getByText("Store deactivated")).toBeTruthy();

    const deactivatedRow = screen.getByText("Closing Soon").closest("tr")!;
    expect(
      within(deactivatedRow).queryByRole("button", { name: /^Edit/ }),
    ).toBeNull();
    expect(
      within(deactivatedRow).queryByRole("button", { name: /^Deactivate/ }),
    ).toBeNull();
    expect(
      within(deactivatedRow).getByRole("button", { name: /^Reactivate/ }),
    ).toBeTruthy();

    await expectNoAxeViolations(container);

    fireEvent.click(
      within(deactivatedRow).getByRole("button", { name: /^Reactivate/ }),
    );
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

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Stores" })).toBeTruthy(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Add store" }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "New store" })).toBeTruthy(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Add label" }));
    fireEvent.click(screen.getByRole("button", { name: "Add label" }));

    // Two removals in a row produce the identical message "Label removed"
    // — each must still land in the live region as a fresh DOM mutation.
    fireEvent.click(screen.getByRole("button", { name: "Remove label 2" }));
    const regions = () =>
      screen.getAllByRole("status").filter((el) => el.textContent);
    await waitFor(() =>
      expect(regions().map((el) => el.textContent)).toStrictEqual([
        "Label removed",
      ]),
    );
    const firstRegion = regions()[0]!;

    fireEvent.click(screen.getByRole("button", { name: "Remove label 1" }));
    await waitFor(() => {
      const active = regions();
      expect(active.map((el) => el.textContent)).toStrictEqual([
        "Label removed",
      ]);
      expect(active[0]).not.toBe(firstRegion);
    });
  });

  it("sorts by a column header and pages the list ten rows at a time", async () => {
    const seeded = Array.from({ length: 12 }, (_, index) => ({
      id: randomUUID(),
      tenant_id: tenantId,
      name: `Paged ${String(index + 1).padStart(2, "0")}`,
    }));
    await withTenantScope(ownerDb, tenantId, (db) =>
      db.insertInto("Store").values(seeded).execute(),
    );

    const { db } = renderRoute({
      router,
      tenantId,
      userId: adminId,
      role: "admin",
      initialLocation: "/stores",
    });
    cleanup = async () => {
      await db.destroy();
      await ownerDb
        .deleteFrom("Store")
        .where(
          "id",
          "in",
          seeded.map((store) => store.id),
        )
        .execute();
    };

    const names = () =>
      screen
        .getAllByRole("row")
        .slice(1)
        .map((row) => row.querySelector("td")?.textContent ?? "");

    // Narrowed to this test's own twelve, so earlier tests' Stores cannot
    // shift the order under it.
    await waitFor(() => expect(names()).toContain("Paged 01"));
    fireEvent.change(screen.getByLabelText("Search stores"), {
      target: { value: "Paged" },
    });

    // Ten of the twelve, ascending by name — the rest are a page away.
    expect(names()).toHaveLength(10);
    expect(names()[0]).toBe("Paged 01");
    expect(names()).not.toContain("Paged 11");

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() => expect(names()).toContain("Paged 11"));
    expect(names()).toHaveLength(2);

    // Sorting returns to page one, now descending.
    fireEvent.click(screen.getByRole("button", { name: /Name/ }));
    await waitFor(() => expect(names()[0]).toBe("Paged 12"));
    expect(names()).toHaveLength(10);
  });
});
