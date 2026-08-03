import { randomUUID } from "node:crypto";

import { createRootRouteWithContext, createRoute, createRouter } from "@tanstack/react-router";
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
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vite-plus/test";

import { AppShell } from "@/components/AppShell.tsx";
import type { OverrideActionType } from "@/features/override/OverridePrompt.tsx";
import { OverridePrompt } from "@/features/override/OverridePrompt.tsx";
import { clearDeviceToken, writeDeviceToken } from "@/lib/device-token.ts";
import { clearPinRoster, writePinRoster } from "@/lib/pin-roster.ts";
import type { RouterContext } from "@/lib/router-context.ts";

// The Override prompt (issue 12, record 060 Q5) — tested by rendering it
// open, the same posture record 060 takes for a controlled Dialog with no
// trigger.
const ownerDb = createDb({ databaseUrl: process.env.DATABASE_URI! });

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

const tenantId = randomUUID();
const storeId = randomUUID();
const cashierId = randomUUID();
const managerId = randomUUID();

function OverridePromptHarness({
  onApproved,
  action = "void_paid_order",
}: {
  onApproved: (overrideId: string) => void;
  action?: OverrideActionType;
}) {
  return (
    <OverridePrompt
      open
      onOpenChange={() => {}}
      action={action}
      subject="Order #1042 · ₱350.00"
      onApproved={onApproved}
    />
  );
}

function buildTestRouter(onApproved: (overrideId: string) => void) {
  const rootRoute = createRootRouteWithContext<RouterContext>()({ component: AppShell });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <OverridePromptHarness onApproved={onApproved} />,
  });
  // renderRoute below rebuilds this router with the real context — this
  // placeholder only has to satisfy createRouter's type.
  return createRouter({
    routeTree: rootRoute.addChildren([indexRoute]),
    context: undefined as unknown as RouterContext,
  });
}

const DEVICE_CODES = ["GT", "GU", "GV", "GW", "GX", "GY", "GZ", "HA"];
let deviceCodeCounter = 0;

async function seedDeviceAndRoster(approversCanApprove = true) {
  const deviceId = randomUUID();
  const token = randomUUID();
  const code = DEVICE_CODES[deviceCodeCounter++]!;
  const { createHash } = await import("node:crypto");
  const tokenHash = createHash("sha256").update(Buffer.from(token, "utf8")).digest("hex");
  await withTenantScope(ownerDb, tenantId, (db) =>
    db
      .insertInto("Device")
      .values({
        id: deviceId,
        tenant_id: tenantId,
        store_id: storeId,
        name: "Override Terminal",
        code,
        token_hash: tokenHash,
      })
      .execute(),
  );
  writeDeviceToken(token, {
    deviceId,
    name: "Override Terminal",
    code: "GT",
    storeId,
    storeName: "Downtown",
  });
  writePinRoster({
    storeId,
    syncedAt: new Date().toISOString(),
    users: [
      {
        userId: cashierId,
        displayName: "Ana Reyes",
        pinHash: null,
        canApproveOverride: false,
      },
      {
        userId: managerId,
        displayName: "Ben Cruz",
        pinHash: await hashPin("482913"),
        canApproveOverride: approversCanApprove,
      },
    ],
  });
  return deviceId;
}

beforeAll(async () => {
  await ownerDb
    .insertInto("Tenant")
    .values({ id: tenantId, name: "Override Prompt Tenant" })
    .execute();
  const passwordHash = await hashPassword("irrelevant");
  await ownerDb
    .insertInto("User")
    .values([
      {
        id: cashierId,
        tenant_id: tenantId,
        email: `ovp-cashier-${randomUUID()}@ovp.test`,
        password_hash: passwordHash,
        first_name: "Ana",
        last_name: "Reyes",
        role: "cashier",
      },
      {
        id: managerId,
        tenant_id: tenantId,
        email: `ovp-manager-${randomUUID()}@ovp.test`,
        password_hash: passwordHash,
        first_name: "Ben",
        last_name: "Cruz",
        role: "manager",
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
        user_id: managerId,
        role: "manager",
        effective_from: new Date(),
      },
    ])
    .execute();
  await withTenantScope(ownerDb, tenantId, (db) =>
    db.insertInto("Store").values({ id: storeId, tenant_id: tenantId, name: "Downtown" }).execute(),
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
          user_id: managerId,
          store_id: storeId,
          assigned: true,
          effective_from: new Date(Date.now() - 60_000),
        },
      ])
      .execute(),
  );
});

afterAll(async () => {
  await ownerDb.deleteFrom("OverrideConsumption").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Override").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Device").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("UserStore").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("UserRole").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Store").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("User").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Tenant").where("id", "=", tenantId).execute();
  await ownerDb.destroy();
});

describe("the Override prompt", () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    clearDeviceToken();
    clearPinRoster();
    localStorage.removeItem("deanpos.pin.throttle");
    await cleanup?.();
    cleanup = undefined;
  });

  it("shows the title, subject, approver picker, and reason field, WCAG 2.2 AA", async () => {
    await seedDeviceAndRoster();
    const onApproved = () => {};
    const { container, db } = renderRoute({
      router: buildTestRouter(onApproved),
      initialLocation: "/",
    });
    cleanup = () => db.destroy();

    await waitFor(() => expect(screen.getByText("Manager approval required")).toBeTruthy());
    expect(screen.getByText("Order #1042 · ₱350.00")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ben Cruz" })).toBeTruthy();
    // Only Users with canApproveOverride are offered.
    expect(screen.queryByRole("button", { name: "Ana Reyes" })).toBeNull();

    await expectNoAxeViolations(container);
  });

  it("no eligible approver shows the empty-roster status and Approve stays disabled", async () => {
    await seedDeviceAndRoster(false);
    const { db } = renderRoute({ router: buildTestRouter(() => {}), initialLocation: "/" });
    cleanup = () => db.destroy();

    await waitFor(() =>
      expect(
        screen.getByText(
          "No manager is set up at this till yet. An admin assigns one in the back office",
        ),
      ).toBeTruthy(),
    );
    expect(screen.getByRole("button", { name: "Approve" }).getAttribute("aria-disabled")).toBe(
      "true",
    );
  });

  it("a wrong PIN shows one alert and keeps the chosen approver, never reaching the server", async () => {
    await seedDeviceAndRoster();
    const { db } = renderRoute({ router: buildTestRouter(() => {}), initialLocation: "/" });
    cleanup = () => db.destroy();

    await waitFor(() => expect(screen.getByRole("button", { name: "Ben Cruz" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Ben Cruz" }));
    fireEvent.change(screen.getByLabelText("Reason (required)"), {
      target: { value: "Rung up in error" },
    });
    for (const digit of "000000") fireEvent.click(screen.getByRole("button", { name: digit }));
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => expect(screen.getByText("That PIN is not correct")).toBeTruthy());
    expect(screen.getByRole("button", { name: "Ben Cruz" }).getAttribute("aria-pressed")).toBe(
      "true",
    );

    const overrides = await withTenantScope(ownerDb, tenantId, (db) =>
      db.selectFrom("Override").selectAll().where("tenant_id", "=", tenantId).execute(),
    );
    expect(overrides).toHaveLength(0);
  });

  it("a correct PIN with a reason records the Override and calls onApproved", async () => {
    await seedDeviceAndRoster();
    let approvedId: string | null = null;
    const { db } = renderRoute({
      router: buildTestRouter((overrideId) => {
        approvedId = overrideId;
      }),
      initialLocation: "/",
    });
    cleanup = () => db.destroy();

    await waitFor(() => expect(screen.getByRole("button", { name: "Ben Cruz" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Ben Cruz" }));
    fireEvent.change(screen.getByLabelText("Reason (required)"), {
      target: { value: "Rung up in error" },
    });
    for (const digit of "482913") fireEvent.click(screen.getByRole("button", { name: digit }));
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => expect(approvedId).not.toBeNull());

    const row = await withTenantScope(ownerDb, tenantId, (db) =>
      db.selectFrom("Override").selectAll().where("id", "=", approvedId!).executeTakeFirst(),
    );
    expect(row?.approver_user_id).toBe(managerId);
    expect(row?.reason).toBe("Rung up in error");
  });

  // Record 061: a Device that can no longer authenticate must not silently
  // succeed. Reason carries a unique marker so a row left behind by an
  // earlier test in this file cannot mask a false pass.
  it("a device that can't authenticate at Approve time records nothing and never calls onApproved", async () => {
    await seedDeviceAndRoster();
    const reason = `Rung up in error ${randomUUID()}`;
    let approvedId: string | null = null;
    const { db } = renderRoute({
      router: buildTestRouter((overrideId) => {
        approvedId = overrideId;
      }),
      initialLocation: "/",
    });
    cleanup = () => db.destroy();

    await waitFor(() => expect(screen.getByRole("button", { name: "Ben Cruz" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Ben Cruz" }));
    fireEvent.change(screen.getByLabelText("Reason (required)"), { target: { value: reason } });
    for (const digit of "482913") fireEvent.click(screen.getByRole("button", { name: digit }));

    clearDeviceToken();
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    // The request completes — an unauthenticated Device is a clean refusal
    // from the handler, not a dropped connection — so this exercises the
    // `result.ok === false` branch's message, unchanged since record 060.
    await waitFor(() => expect(screen.getByText("Couldn't record the approval")).toBeTruthy());
    expect(approvedId).toBeNull();
    expect(screen.getByText("Manager approval required")).toBeTruthy();
    expect((screen.getByLabelText("Reason (required)") as HTMLInputElement).value).toBe(reason);

    const overrides = await withTenantScope(ownerDb, tenantId, (db) =>
      db.selectFrom("Override").selectAll().where("reason", "=", reason).execute(),
    );
    expect(overrides).toHaveLength(0);
  });

  it.each([
    [1280, 800],
    [390, 844],
  ])(
    "the tenth Device failure announces the lock immediately and disables the approver picker, WCAG 2.2 AA at %ipx",
    async (width, height) => {
      setViewport(width, height);
      await seedDeviceAndRoster();
      const { container, db } = renderRoute({
        router: buildTestRouter(() => {}),
        initialLocation: "/",
      });
      cleanup = () => db.destroy();

      await waitFor(() => expect(screen.getByRole("button", { name: "Ben Cruz" })).toBeTruthy());
      fireEvent.click(screen.getByRole("button", { name: "Ben Cruz" }));
      fireEvent.change(screen.getByLabelText("Reason (required)"), {
        target: { value: "Rung up in error" },
      });

      // Nine prior Device failures (record 059's two counters) — the tenth,
      // submitted below, is the one that must trip and announce the lock.
      localStorage.setItem(
        "deanpos.pin.throttle",
        JSON.stringify({
          device: { failures: 9, lockedUntil: null, lastAttemptAt: Date.now() },
          users: {},
        }),
      );
      for (const digit of "000000") fireEvent.click(screen.getByRole("button", { name: digit }));
      fireEvent.click(screen.getByRole("button", { name: "Approve" }));

      await waitFor(() =>
        expect(
          screen.getByText("Too many attempts. This till is locked for 2 minutes"),
        ).toBeTruthy(),
      );
      expect(screen.getByRole("button", { name: "Ben Cruz" }).getAttribute("aria-disabled")).toBe(
        "true",
      );

      await expectNoAxeViolations(container);
    },
  );

  // Record 061: a refusal and a dropped connection carry different copy. The
  // `fetch` override forces a real rejection, so this reaches the
  // `unreachable` branch rather than the refusal branch above.
  it("a dropped connection at Approve time shows the transport alert, keeps the dialog and form, and records nothing", async () => {
    await seedDeviceAndRoster();
    const reason = `Rung up in error ${randomUUID()}`;
    let approvedId: string | null = null;
    const { db } = renderRoute({
      router: buildTestRouter((overrideId) => {
        approvedId = overrideId;
      }),
      initialLocation: "/",
      fetch: () => Promise.reject(new Error("network failure")),
    });
    cleanup = () => db.destroy();

    await waitFor(() => expect(screen.getByRole("button", { name: "Ben Cruz" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Ben Cruz" }));
    fireEvent.change(screen.getByLabelText("Reason (required)"), { target: { value: reason } });
    for (const digit of "482913") fireEvent.click(screen.getByRole("button", { name: digit }));
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() =>
      expect(
        screen.getByText(
          "The till couldn't reach the server. The approval was not recorded — try again in a moment",
        ),
      ).toBeTruthy(),
    );
    expect(approvedId).toBeNull();
    expect(screen.getByText("Manager approval required")).toBeTruthy();
    expect((screen.getByLabelText("Reason (required)") as HTMLInputElement).value).toBe(reason);

    const overrides = await withTenantScope(ownerDb, tenantId, (db) =>
      db.selectFrom("Override").selectAll().where("reason", "=", reason).execute(),
    );
    expect(overrides).toHaveLength(0);
  });
});
