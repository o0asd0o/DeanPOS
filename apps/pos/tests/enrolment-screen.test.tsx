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
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vite-plus/test";

import { readDeviceToken, writeDeviceToken } from "@/lib/device-token.ts";
import { router } from "@/router.tsx";

// The POS enrolment screen (issue 09, record 056 Q5) — no lofi mock beyond
// the superseded drawing at design/lofi/pos/device-enrolment-1280.svg.
const ownerDb = createDb({ databaseUrl: process.env.DATABASE_URI! });

const tenantId = randomUUID();
const adminId = randomUUID();
const storeId = randomUUID();

beforeAll(async () => {
  await ownerDb
    .insertInto("Tenant")
    .values({ id: tenantId, name: "Enrolment Screen Tenant" })
    .execute();
  const passwordHash = await hashPassword("irrelevant");
  await ownerDb
    .insertInto("User")
    .values({
      id: adminId,
      tenant_id: tenantId,
      email: `enrol-screen-admin-${randomUUID()}@pm.test`,
      password_hash: passwordHash,
      role: "admin",
    })
    .execute();
  await withTenantScope(ownerDb, tenantId, (db) =>
    db.insertInto("Store").values({ id: storeId, tenant_id: tenantId, name: "Malabon" }).execute(),
  );
});

afterAll(async () => {
  await ownerDb.deleteFrom("EnrolmentCode").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Device").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Store").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("User").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Tenant").where("id", "=", tenantId).execute();
  await ownerDb.destroy();
});

describe("the enrolment screen", () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    localStorage.clear();
    await cleanup?.();
    cleanup = undefined;
  });

  it("shows one input, refuses an unrecognised code with one failure message, then enrols on a valid code", async () => {
    // Seed an enrolment secret directly — device.generateCode is a
    // back-office procedure, out of scope for this app's own seam.
    await withTenantScope(ownerDb, tenantId, (db) =>
      db
        .insertInto("EnrolmentCode")
        .values({
          id: randomUUID(),
          tenant_id: tenantId,
          store_id: storeId,
          name: "Counter 2",
          code: "C2",
          secret: "F4K92X7M",
          expires_at: new Date(Date.now() + 10 * 60 * 1000),
        })
        .execute(),
    );

    const { container, db } = renderRoute({ router, initialLocation: "/enrol" });
    cleanup = () => db.destroy();

    await waitFor(() => expect(screen.getByLabelText("Enrolment code")).toBeTruthy());
    // Only one input on this screen — no "Name this terminal" field.
    expect(screen.getAllByRole("textbox")).toHaveLength(1);

    await expectNoAxeViolations(container);

    fireEvent.change(screen.getByLabelText("Enrolment code"), { target: { value: "ZZZZZZZZ" } });
    fireEvent.click(screen.getByRole("button", { name: "Enrol this terminal" }));

    await waitFor(() =>
      expect(
        screen.getByText("That code is expired, already used, or not recognised"),
      ).toBeTruthy(),
    );

    // Dashes and lower-case are normalised before send.
    fireEvent.change(screen.getByLabelText("Enrolment code"), { target: { value: "f4k9-2x7m" } });
    fireEvent.click(screen.getByRole("button", { name: "Enrol this terminal" }));

    await waitFor(() => expect(screen.getByText("This terminal is enrolled")).toBeTruthy());
    expect(screen.getByText("Counter 2 · Malabon")).toBeTruthy();
    expect(readDeviceToken()).not.toBeNull();

    await expectNoAxeViolations(container);
  });

  it("a terminal already holding a token never sees the form — terminal.me routes it to /", async () => {
    const deviceId = randomUUID();
    // Mirrors backend/src/device/token.ts's hashing exactly (record 056
    // Q2) — "backend" is not a devDependency of apps/pos, so this test
    // reproduces the hash rather than importing across the app boundary.
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(Buffer.from(token, "utf8")).digest("hex");
    await withTenantScope(ownerDb, tenantId, (db) =>
      db
        .insertInto("Device")
        .values({
          id: deviceId,
          tenant_id: tenantId,
          store_id: storeId,
          name: "Counter 3",
          code: "C3",
          token_hash: tokenHash,
        })
        .execute(),
    );
    writeDeviceToken(token, {
      deviceId,
      name: "Counter 3",
      code: "C3",
      storeId,
      storeName: "Malabon",
    });

    const { db } = renderRoute({ router, initialLocation: "/enrol" });
    cleanup = async () => {
      await db.destroy();
      await ownerDb.deleteFrom("Device").where("id", "=", deviceId).execute();
    };

    await waitFor(() => expect(screen.queryByLabelText("Enrolment code")).toBeNull());
  });

  it("a revoked terminal sees the blocked message, never the form, and storage is untouched", async () => {
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
          name: "Counter 4",
          code: "C4",
          token_hash: tokenHash,
          revoked_at: new Date(),
        })
        .execute(),
    );
    writeDeviceToken(token, {
      deviceId,
      name: "Counter 4",
      code: "C4",
      storeId,
      storeName: "Malabon",
    });

    const { db } = renderRoute({ router, initialLocation: "/enrol" });
    cleanup = async () => {
      await db.destroy();
      await ownerDb.deleteFrom("Device").where("id", "=", deviceId).execute();
    };

    await waitFor(() =>
      expect(
        screen.getByText("This terminal has been revoked. An admin must enrol it again."),
      ).toBeTruthy(),
    );
    expect(screen.queryByLabelText("Enrolment code")).toBeNull();
    expect(readDeviceToken()).toBe(token);
  });
});
