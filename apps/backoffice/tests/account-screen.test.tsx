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
} from "api/src/test-seam-react.tsx";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vite-plus/test";

import { router } from "@/router.tsx";

// The /account screen (issue 15, record 063 Amendment 1 §3) — profile,
// read-only, and PIN, moved from `PinDialog`. No lofi mock; the record and
// the settings/stores screens set the shape.
const ownerDb = createDb({ databaseUrl: process.env.DATABASE_URI! });

const tenantId = randomUUID();
const storeId = randomUUID();
const cashierId = randomUUID();
const userIdByRole: Record<"cashier" | "manager" | "admin", string> = {
  cashier: randomUUID(),
  manager: randomUUID(),
  admin: randomUUID(),
};

beforeAll(async () => {
  await ownerDb
    .insertInto("Tenant")
    .values({ id: tenantId, name: "Account Screen Tenant" })
    .execute();
  await withTenantScope(ownerDb, tenantId, (db) =>
    db.insertInto("Store").values({ id: storeId, tenant_id: tenantId, name: "Downtown" }).execute(),
  );
  const passwordHash = await hashPassword("irrelevant");
  await ownerDb
    .insertInto("User")
    .values({
      id: cashierId,
      tenant_id: tenantId,
      email: `account-screen-cashier-${randomUUID()}@pm.test`,
      password_hash: passwordHash,
      role: "cashier",
      first_name: "Ada",
      last_name: "Lovelace",
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
        effective_from: new Date(),
      })
      .execute(),
  );
  for (const role of ["cashier", "manager", "admin"] as const) {
    await ownerDb
      .insertInto("User")
      .values({
        id: userIdByRole[role],
        tenant_id: tenantId,
        email: `account-screen-${role}-${randomUUID()}@pm.test`,
        password_hash: passwordHash,
        role,
      })
      .execute();
  }
});

afterAll(async () => {
  await ownerDb.deleteFrom("UserStore").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Store").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("User").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Tenant").where("id", "=", tenantId).execute();
  await ownerDb.destroy();
});

describe("the Account screen", () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await cleanup?.();
    cleanup = undefined;
  });

  it("shows the signed-in User's own name, email, role, and assigned Stores — nobody else's", async () => {
    const { container, db } = renderRoute({
      router,
      tenantId,
      userId: cashierId,
      role: "cashier",
      firstName: "Ada",
      lastName: "Lovelace",
      initialLocation: "/account",
    });
    cleanup = () => db.destroy();

    await waitFor(() => expect(screen.getByText("Ada Lovelace")).toBeTruthy());
    expect(screen.getByText("cashier")).toBeTruthy();
    expect(screen.getByText("Downtown")).toBeTruthy();

    for (const role of ["cashier", "manager", "admin"] as const) {
      const userIdEmail = await ownerDb
        .selectFrom("User")
        .select("email")
        .where("id", "=", userIdByRole[role])
        .executeTakeFirstOrThrow();
      expect(screen.queryByText(userIdEmail.email)).toBeNull();
    }

    await expectNoAxeViolations(container);
  });

  for (const role of ["cashier", "manager", "admin"] as const) {
    it(`saves a PIN for ${role}`, async () => {
      const { db } = renderRoute({
        router,
        tenantId,
        userId: userIdByRole[role],
        role,
        initialLocation: "/account",
      });
      cleanup = () => db.destroy();

      const field = await waitFor(() => screen.getByLabelText("PIN"));
      fireEvent.change(field, { target: { value: "1357" } });
      fireEvent.click(screen.getByRole("button", { name: "Save PIN" }));

      await waitFor(() => expect(screen.getByText("PIN saved")).toBeTruthy());
    });
  }
});
