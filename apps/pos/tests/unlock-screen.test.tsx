import { createHash, randomBytes, randomUUID } from "node:crypto";

import {
  cleanup as unmountAll,
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
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vite-plus/test";

import { clearPinRoster, readPinRoster } from "@/lib/pin-roster.ts";
import { router } from "@/router.tsx";
import { clearDeviceToken, readDeviceToken, writeDeviceToken } from "@/lib/device-token.ts";
import { pinLockUntil, readPinThrottle } from "@/lib/pin-throttle.ts";

// The unlock screen (issue 10, record 057 Q4).
const ownerDb = createDb({ databaseUrl: process.env.DATABASE_URI! });

const tenantId = randomUUID();
const storeId = randomUUID();
const cashierId = randomUUID();
const noPinUserId = randomUUID();
const cashier2Id = randomUUID();

// Criterion 11's two exact sizes — jsdom never reflows, so this only drives
// `window.innerWidth`/`innerHeight` for the axe and structural checks.
function setViewport(width: number, height: number) {
  Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: width });
  Object.defineProperty(window, "innerHeight", {
    writable: true,
    configurable: true,
    value: height,
  });
  window.dispatchEvent(new Event("resize"));
}

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

  beforeAll(async () => {
    const passwordHash = await passwordHashPromise;
    const pinHash = await hashPin("482913");
    const pinHash2 = await hashPin("135790");
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
        {
          id: cashier2Id,
          tenant_id: tenantId,
          email: `unlock-cashier2-${randomUUID()}@unlock.test`,
          password_hash: passwordHash,
          first_name: "Carla",
          last_name: "Ruiz",
          role: "cashier",
          pin_hash: pinHash2,
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
        {
          id: randomUUID(),
          tenant_id: tenantId,
          user_id: cashier2Id,
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
          {
            id: randomUUID(),
            tenant_id: tenantId,
            user_id: cashier2Id,
            store_id: storeId,
            assigned: true,
            effective_from: new Date(Date.now() - 60_000),
          },
        ])
        .execute(),
    );
  });

  afterEach(async () => {
    clearDeviceToken();
    clearPinRoster();
    localStorage.removeItem("deanpos.pin.throttle");
    await cleanup?.();
    cleanup = undefined;
  });

  async function selectAnaAndTypeWrong(digits = "000000") {
    fireEvent.click(screen.getByRole("button", { name: "Ana Reyes" }));
    for (const digit of digits) {
      fireEvent.click(screen.getByRole("button", { name: digit }));
    }
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));
    await waitFor(() => expect((screen.getByLabelText("PIN") as HTMLInputElement).value).toBe(""));
  }

  it.each([
    [1280, 800],
    [390, 844],
  ])(
    "shows the picker, the masked PIN field, and unlocks with the right PIN, WCAG 2.2 AA at %ipx",
    async (width, height) => {
      setViewport(width, height);
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
    },
  );

  it("a wrong PIN shows one alert, clears the digits, and keeps the User selected", async () => {
    await seedDeviceAndRoster();

    const { db } = renderRoute({ router, initialLocation: "/" });
    cleanup = () => db.destroy();

    await waitFor(() => expect(screen.getByText("Ana Reyes")).toBeTruthy(), { timeout: 3000 });
    fireEvent.click(screen.getByRole("button", { name: "Ana Reyes" }));
    expect(document.activeElement).toBe(screen.getByLabelText("PIN"));
    expect(screen.getByRole("button", { name: "Backspace" }).getAttribute("aria-disabled")).toBe(
      "true",
    );
    for (const digit of "000000") {
      fireEvent.click(screen.getByRole("button", { name: digit }));
    }
    expect(screen.getByRole("button", { name: "Backspace" }).getAttribute("aria-disabled")).toBe(
      "false",
    );
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

    const tokenBefore = readDeviceToken();
    const rosterBefore = readPinRoster();

    fireEvent.click(screen.getByText("Lock"));

    await waitFor(() => expect(screen.getByText("Ana Reyes")).toBeTruthy(), { timeout: 3000 });
    expect(readDeviceToken()).toBe(tokenBefore);
    expect(readPinRoster()).toEqual(rosterBefore);
  });

  it("syncs the roster into deanpos.pin.roster on load", async () => {
    await seedDeviceAndRoster();

    const { db } = renderRoute({ router, initialLocation: "/" });
    cleanup = () => db.destroy();

    await waitFor(() => expect(readPinRoster()?.users.length).toBeGreaterThan(0));
    expect(readPinRoster()?.storeId).toBe(storeId);
  });

  it("5 wrong PINs lock Ana, the strip says when it lifts, and the lock survives a page reload — criteria 1, 2", async () => {
    await seedDeviceAndRoster();

    const { db } = renderRoute({ router, initialLocation: "/" });
    await waitFor(() => expect(screen.getByText("Ana Reyes")).toBeTruthy(), { timeout: 3000 });

    for (let i = 0; i < 5; i++) await selectAnaAndTypeWrong();

    await waitFor(() => expect(screen.getByText(/Too many attempts —/)).toBeTruthy());
    expect(screen.getByText(/Too many attempts —/).textContent).toMatch(/locked for \d:\d\d/);
    expect(pinLockUntil(readPinThrottle(), cashierId)).not.toBeNull();

    // Simulate a reload: unmount, close the first render's db, and render
    // fresh against the same localStorage — the reload's whole bypass.
    unmountAll();
    await db.destroy();
    const { container, db: db2 } = renderRoute({ router, initialLocation: "/" });
    cleanup = () => db2.destroy();

    await waitFor(() => expect(screen.getByText("Ana Reyes")).toBeTruthy(), { timeout: 3000 });
    fireEvent.click(screen.getByRole("button", { name: "Ana Reyes" }));
    await waitFor(() => expect(screen.getByText(/Too many attempts —/)).toBeTruthy());
    await expectNoAxeViolations(container);
  });

  it("failing Ana then switching to Carla does not reset the Device counter — criterion 4", async () => {
    await seedDeviceAndRoster();

    const { db } = renderRoute({ router, initialLocation: "/" });
    cleanup = () => db.destroy();
    await waitFor(() => expect(screen.getByText("Ana Reyes")).toBeTruthy(), { timeout: 3000 });

    // 5 wrong attempts locks Ana individually and puts the Device at 5.
    for (let i = 0; i < 5; i++) await selectAnaAndTypeWrong();
    expect(pinLockUntil(readPinThrottle(), cashier2Id)).toBeNull();

    // 5 more wrong attempts as Carla — a different User — pushes the Device
    // to 10 and locks the whole till, even though Carla alone never reached
    // her own 5-failure limit.
    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByRole("button", { name: "Carla Ruiz" }));
      for (const digit of "000000") fireEvent.click(screen.getByRole("button", { name: digit }));
      fireEvent.click(screen.getByRole("button", { name: "Unlock" }));
      await waitFor(() =>
        expect((screen.getByLabelText("PIN") as HTMLInputElement).value).toBe(""),
      );
    }

    const state = readPinThrottle();
    expect(state.device.failures).toBe(10);
    // The Device lock now blocks every User, including one who never typed
    // a wrong PIN herself.
    expect(pinLockUntil(state, noPinUserId)).not.toBeNull();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Ana Reyes" }).getAttribute("aria-disabled")).toBe(
        "true",
      ),
    );
  });

  it("a correct PIN after the lock lifts unlocks normally and zeroes both counters — criterion 5", async () => {
    await seedDeviceAndRoster();

    const { db } = renderRoute({ router, initialLocation: "/" });
    cleanup = () => db.destroy();
    await waitFor(() => expect(screen.getByText("Ana Reyes")).toBeTruthy(), { timeout: 3000 });

    // Seed a User lock that expires almost immediately, rather than waiting
    // out the real 2-minute lock.
    localStorage.setItem(
      "deanpos.pin.throttle",
      JSON.stringify({
        device: { failures: 0, lockedUntil: null, lastAttemptAt: null },
        users: {
          [cashierId]: { failures: 5, lockedUntil: Date.now() + 150, lastAttemptAt: Date.now() },
        },
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Ana Reyes" }));
    await waitFor(() => expect(screen.getByText(/Too many attempts —/)).toBeTruthy());
    await waitFor(() => expect(screen.queryByText(/Too many attempts —/)).toBeNull(), {
      timeout: 2000,
    });

    for (const digit of "482913") fireEvent.click(screen.getByRole("button", { name: digit }));
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));

    await waitFor(() => expect(screen.getByText("Lock")).toBeTruthy(), { timeout: 3000 });
    const state = readPinThrottle();
    expect(state.device.failures).toBe(0);
    expect(state.users[cashierId]).toBeUndefined();
  });

  it.each([
    [1280, 800],
    [390, 844],
  ])("the locked strip is WCAG 2.2 AA at %ipx", async (width, height) => {
    setViewport(width, height);
    await seedDeviceAndRoster();

    const { container, db } = renderRoute({ router, initialLocation: "/" });
    cleanup = () => db.destroy();
    await waitFor(() => expect(screen.getByText("Ana Reyes")).toBeTruthy(), { timeout: 3000 });

    for (let i = 0; i < 5; i++) await selectAnaAndTypeWrong();
    await waitFor(() => expect(screen.getByText(/Too many attempts —/)).toBeTruthy());

    await expectNoAxeViolations(container);
  });
});
