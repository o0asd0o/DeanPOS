import { createHash, randomBytes, randomUUID } from "node:crypto";

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
import { hashPin } from "contract/src/pin.ts";
import { afterAll, afterEach, describe, expect, it } from "vite-plus/test";

import { writeDeviceToken } from "@/lib/device-token.ts";
import { router } from "@/router.tsx";

// Issue 10 gates "/" behind the unlock screen — this seeds one User with a
// known PIN and drives the real keypad, then falls through to the original
// pending/loaded/error assertions for the Ping route behind it.
const ownerDb = createDb({ databaseUrl: process.env.DATABASE_URI! });
const tenantId = randomUUID();
const storeId = randomUUID();
const userId = randomUUID();
const pin = "135790";

afterAll(async () => {
  await ownerDb.deleteFrom("Device").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("UserStore").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("UserRole").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Store").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("User").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Tenant").where("id", "=", tenantId).execute();
  await ownerDb.destroy();
});

async function unlock() {
  await waitFor(() => expect(screen.getByText("Ana Reyes")).toBeTruthy(), { timeout: 3000 });
  fireEvent.click(screen.getByRole("button", { name: "Ana Reyes" }));
  for (const digit of pin) {
    fireEvent.click(screen.getByRole("button", { name: digit }));
  }
  fireEvent.click(screen.getByRole("button", { name: "Unlock" }));
  await waitFor(() => expect(screen.getByText("Lock")).toBeTruthy(), { timeout: 3000 });
}

describe("the terminal shell's ping route, behind the unlock screen", () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    localStorage.clear();
    await cleanup?.();
    cleanup = undefined;
  });

  it("shows the pending line, then the ping value read from the lane database", async () => {
    await ownerDb
      .insertInto("Tenant")
      .values({ id: tenantId, name: "Ping Route Tenant" })
      .execute();
    const passwordHash = await hashPassword("irrelevant");
    const pinHash = await hashPin(pin);
    await ownerDb
      .insertInto("User")
      .values({
        id: userId,
        tenant_id: tenantId,
        email: `ping-route-${randomUUID()}@ping.test`,
        password_hash: passwordHash,
        first_name: "Ana",
        last_name: "Reyes",
        role: "cashier",
        pin_hash: pinHash,
      })
      .execute();
    await ownerDb
      .insertInto("UserRole")
      .values({
        id: randomUUID(),
        tenant_id: tenantId,
        user_id: userId,
        role: "cashier",
        effective_from: new Date(),
      })
      .execute();
    await withTenantScope(ownerDb, tenantId, (db) =>
      db
        .insertInto("Store")
        .values({ id: storeId, tenant_id: tenantId, name: "Ping Store" })
        .execute(),
    );
    await withTenantScope(ownerDb, tenantId, (db) =>
      db
        .insertInto("UserStore")
        .values({
          id: randomUUID(),
          tenant_id: tenantId,
          user_id: userId,
          store_id: storeId,
          assigned: true,
          effective_from: new Date(Date.now() - 60_000),
        })
        .execute(),
    );

    const deviceId = randomUUID();
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(Buffer.from(token, "utf8")).digest("hex");
    await withTenantScope(ownerDb, tenantId, (db) =>
      db
        .insertInto("Device")
        .values({
          id: deviceId,
          tenant_id: tenantId,
          store_id: storeId,
          name: "Ping Terminal",
          code: "PR",
          token_hash: tokenHash,
        })
        .execute(),
    );
    writeDeviceToken(token, {
      deviceId,
      name: "Ping Terminal",
      code: "PR",
      storeId,
      storeName: "Ping Store",
    });

    const { container, db } = renderRoute({ router });
    cleanup = () => db.destroy();

    await unlock();

    const { message } = await db.selectFrom("Ping").select("message").executeTakeFirstOrThrow();
    await waitFor(() => expect(screen.getByText(message)).toBeTruthy());
    await expectNoAxeViolations(container);

    expect(container.querySelectorAll("header")).toHaveLength(1);
    expect(container.querySelector("header")?.textContent).toContain("DeanPOS");
    expect(container.querySelectorAll("main")).toHaveLength(1);
    expect(container.querySelector("main")?.id).toBe("main-content");

    await expectNoAxeViolations(container);
  });
});
