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

import { readPinRoster } from "@/lib/pin-roster.ts";
import { router } from "@/router.tsx";
import { writeDeviceToken } from "@/lib/device-token.ts";

// The unlock screen (issue 10, record 057 Q4).
const ownerDb = createDb({ databaseUrl: process.env.DATABASE_URI! });

const tenantId = randomUUID();
const storeId = randomUUID();
const cashierId = randomUUID();
const noPinUserId = randomUUID();

let deviceCodeCounter = 0;

async function seedDeviceAndRoster() {
  const deviceId = randomUUID();
  const code = `F${deviceCodeCounter++}`;
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(Buffer.from(token, "utf8")).digest("hex");
  await withTenantScope(ownerDb, tenantId, (db) =>
    db
      .insertInto("Device")
      .values({
        id: deviceId,
        tenant_id: tenantId,
        store_id: storeId,
        name: "Front Counter",
        code,
        token_hash: tokenHash,
      })
      .execute(),
  );
  writeDeviceToken(token, {
    deviceId,
    name: "Front Counter",
    code,
    storeId,
    storeName: "Downtown",
  });
  return deviceId;
}

const passwordHashPromise = hashPassword("irrelevant");

afterAll(async () => {
  await ownerDb.deleteFrom("Device").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("UserStore").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("UserRole").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Store").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("User").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Tenant").where("id", "=", tenantId).execute();
  await ownerDb.destroy();
});

describe("the unlock screen", () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    localStorage.clear();
    await cleanup?.();
    cleanup = undefined;
  });

  it("shows the picker, the masked PIN field, and unlocks with the right PIN", async () => {
    const passwordHash = await passwordHashPromise;
    const pinHash = await hashPin("482913");
    await ownerDb.insertInto("Tenant").values({ id: tenantId, name: "Unlock Tenant" }).execute();
    await ownerDb
      .insertInto("User")
      .values([
        {
          id: cashierId,
          tenant_id: tenantId,
          email: `unlock-cashier-${randomUUID()}@unlock.test`,
          password_hash: passwordHash,
          first_name: "Ana",
          last_name: "Reyes",
          role: "cashier",
          pin_hash: pinHash,
        },
        {
          id: noPinUserId,
          tenant_id: tenantId,
          email: `unlock-nopin-${randomUUID()}@unlock.test`,
          password_hash: passwordHash,
          first_name: "Ben",
          last_name: "Cruz",
          role: "cashier",
          pin_hash: null,
        },
      ])
      .execute();
    await ownerDb
      .insertInto("UserRole")
      .values([
        {
          id: randomUUID(),
          tenant_id: tenantId,
          user_id: cashierId,
          role: "cashier",
          effective_from: new Date(),
        },
        {
          id: randomUUID(),
          tenant_id: tenantId,
          user_id: noPinUserId,
          role: "cashier",
          effective_from: new Date(),
        },
      ])
      .execute();
    await withTenantScope(ownerDb, tenantId, (db) =>
      db
        .insertInto("Store")
        .values({ id: storeId, tenant_id: tenantId, name: "Downtown" })
        .execute(),
    );
    await withTenantScope(ownerDb, tenantId, (db) =>
      db
        .insertInto("UserStore")
        .values([
          {
            id: randomUUID(),
            tenant_id: tenantId,
            user_id: cashierId,
            store_id: storeId,
            assigned: true,
            effective_from: new Date(Date.now() - 60_000),
          },
          {
            id: randomUUID(),
            tenant_id: tenantId,
            user_id: noPinUserId,
            store_id: storeId,
            assigned: true,
            effective_from: new Date(Date.now() - 60_000),
          },
        ])
        .execute(),
    );

    await seedDeviceAndRoster();

    const { container, db } = renderRoute({ router, initialLocation: "/" });
    cleanup = () => db.destroy();

    await waitFor(() => expect(screen.getByText("Ana Reyes")).toBeTruthy(), { timeout: 3000 });
    expect(screen.getByText("Ben Cruz")).toBeTruthy();

    await expectNoAxeViolations(container);

    fireEvent.click(screen.getByRole("button", { name: "Ana Reyes" }));
    expect(screen.getByRole("button", { name: "Ana Reyes" }).getAttribute("aria-pressed")).toBe(
      "true",
    );

    for (const digit of "482913") {
      fireEvent.click(screen.getByRole("button", { name: digit }));
    }
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));

    await waitFor(() => expect(screen.getByText("Lock")).toBeTruthy(), { timeout: 3000 });
    await expectNoAxeViolations(container);
  });

  it("a wrong PIN shows one alert, clears the digits, and keeps the User selected", async () => {
    await seedDeviceAndRoster();

    const { db } = renderRoute({ router, initialLocation: "/" });
    cleanup = () => db.destroy();

    await waitFor(() => expect(screen.getByText("Ana Reyes")).toBeTruthy(), { timeout: 3000 });
    fireEvent.click(screen.getByRole("button", { name: "Ana Reyes" }));
    for (const digit of "000000") {
      fireEvent.click(screen.getByRole("button", { name: digit }));
    }
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));

    await waitFor(() => expect(screen.getByText("That PIN is not correct")).toBeTruthy(), {
      timeout: 3000,
    });
    expect(screen.getByRole("button", { name: "Ana Reyes" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect((screen.getByLabelText("PIN") as HTMLInputElement).value).toBe("");
  });

  it("a User with no PIN yet shows the connect-to-set-one message and Unlock stays disabled", async () => {
    await seedDeviceAndRoster();

    const { db } = renderRoute({ router, initialLocation: "/" });
    cleanup = () => db.destroy();

    await waitFor(() => expect(screen.getByText("Ben Cruz")).toBeTruthy(), { timeout: 3000 });
    fireEvent.click(screen.getByRole("button", { name: "Ben Cruz" }));

    await waitFor(() =>
      expect(
        screen.getByText(
          "Ben Cruz has no PIN yet. They set one in the back office, from their account menu",
        ),
      ).toBeTruthy(),
    );
    expect(screen.getByRole("button", { name: "Unlock" }).getAttribute("aria-disabled")).toBe(
      "true",
    );
  });

  it("no roster synced yet shows the empty-till message", async () => {
    // No Device seeded at all — terminal.pinSync has nothing to authenticate
    // with, and there is no cached roster either.
    const { db } = renderRoute({ router, initialLocation: "/" });
    cleanup = () => db.destroy();

    await waitFor(() =>
      expect(
        screen.getByText(
          "No one is set up at this till yet. Connect once to load the store’s users",
        ),
      ).toBeTruthy(),
    );
  });

  it("locking returns to the PIN prompt and clears the acting User, leaving device token and roster untouched", async () => {
    await seedDeviceAndRoster();

    const { db } = renderRoute({ router, initialLocation: "/" });
    cleanup = () => db.destroy();

    await waitFor(() => expect(screen.getByText("Ana Reyes")).toBeTruthy(), { timeout: 3000 });
    fireEvent.click(screen.getByRole("button", { name: "Ana Reyes" }));
    for (const digit of "482913") {
      fireEvent.click(screen.getByRole("button", { name: digit }));
    }
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));
    await waitFor(() => expect(screen.getByText("Lock")).toBeTruthy(), { timeout: 3000 });

    const tokenBefore = localStorage.getItem("deanpos.device.token");
    const rosterBefore = localStorage.getItem("deanpos.pin.roster");

    fireEvent.click(screen.getByText("Lock"));

    await waitFor(() => expect(screen.getByText("Ana Reyes")).toBeTruthy(), { timeout: 3000 });
    expect(localStorage.getItem("deanpos.device.token")).toBe(tokenBefore);
    expect(localStorage.getItem("deanpos.pin.roster")).toBe(rosterBefore);
  });

  it("syncs the roster into deanpos.pin.roster on load", async () => {
    await seedDeviceAndRoster();

    const { db } = renderRoute({ router, initialLocation: "/" });
    cleanup = () => db.destroy();

    await waitFor(() => expect(readPinRoster()?.users.length).toBeGreaterThan(0));
    expect(readPinRoster()?.storeId).toBe(storeId);
  });
});
