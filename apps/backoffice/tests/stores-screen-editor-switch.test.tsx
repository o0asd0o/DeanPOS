import { randomUUID } from "node:crypto";

import {
  createDb,
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

// Finding 1, its own file/tenant — this suite already isolates
// repeated-render tests per file (see stores-screen-manager.test.tsx).
const ownerDb = createDb({ databaseUrl: process.env.DATABASE_URI! });

const tenantId = randomUUID();
const adminId = randomUUID();

beforeAll(async () => {
  await ownerDb
    .insertInto("Tenant")
    .values({ id: tenantId, name: "Stores Screen Editor Switch Tenant" })
    .execute();
  await ownerDb
    .insertInto("User")
    .values({
      id: adminId,
      tenant_id: tenantId,
      email: `stores-screen-editor-switch-${randomUUID()}@store.test`,
      password_hash: await hashPassword("irrelevant"),
      role: "admin",
    })
    .execute();
});

afterAll(async () => {
  await ownerDb.deleteFrom("Store").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("User").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Tenant").where("id", "=", tenantId).execute();
  await ownerDb.destroy();
});

describe("the Stores screen — switching editors (finding 1)", () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await cleanup?.();
    cleanup = undefined;
  });

  it("switching the editor directly from Store A to Store B does not save B with A's draft", async () => {
    const storeAId = randomUUID();
    const storeBId = randomUUID();
    await withTenantScope(ownerDb, tenantId, (db) =>
      db
        .insertInto("Store")
        .values([
          { id: storeAId, tenant_id: tenantId, name: "Store A", table_labels: ["Patio"] },
          { id: storeBId, tenant_id: tenantId, name: "Store B", table_labels: [] },
        ])
        .execute(),
    );

    const { db } = renderRoute({
      router,
      tenantId,
      userId: adminId,
      role: "admin",
      initialLocation: "/stores",
    });
    cleanup = () => db.destroy();

    await waitFor(() => expect(screen.getByText("Store A")).toBeTruthy());
    const rowA = screen.getByText("Store A").closest("tr")!;
    fireEvent.click(within(rowA).getByRole("button", { name: "Edit Store A" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Edit Store A" })).toBeTruthy());
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Store A");
    expect(screen.getAllByLabelText(/Table label \d/).length).toBe(1);

    // Straight from editing A to editing B — never closed in between.
    const rowB = screen.getByText("Store B").closest("tr")!;
    fireEvent.click(within(rowB).getByRole("button", { name: "Edit Store B" }));

    await waitFor(() => expect(screen.getByRole("heading", { name: "Edit Store B" })).toBeTruthy());
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Store B");
    expect(screen.queryAllByLabelText(/Table label \d/).length).toBe(0);
  });
});
