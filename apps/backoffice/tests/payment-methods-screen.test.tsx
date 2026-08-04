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
  withTenantScope,
  within,
} from "api/src/test-seam-react.tsx";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vite-plus/test";

import { router } from "@/router.tsx";

// The payment-methods screen (issue 08, record 054) — no lofi mock beyond a
// superseded drawing; record 054 is the contract.
const ownerDb = createDb({ databaseUrl: process.env.DATABASE_URI! });

const tenantId = randomUUID();
const adminId = randomUUID();
const storeId = randomUUID();
const cashId = randomUUID();

beforeAll(async () => {
  await ownerDb
    .insertInto("Tenant")
    .values({ id: tenantId, name: "Payment Methods Screen Tenant" })
    .execute();
  const passwordHash = await hashPassword("irrelevant");
  await ownerDb
    .insertInto("User")
    .values({
      id: adminId,
      tenant_id: tenantId,
      email: `pm-screen-admin-${randomUUID()}@pm.test`,
      password_hash: passwordHash,
      role: "admin",
    })
    .execute();
  await withTenantScope(ownerDb, tenantId, (db) =>
    db.insertInto("Store").values({ id: storeId, tenant_id: tenantId, name: "Downtown" }).execute(),
  );
  await withTenantScope(ownerDb, tenantId, (db) =>
    db
      .insertInto("PaymentMethod")
      .values({ id: cashId, tenant_id: tenantId, name: "Cash", kind: "cash" })
      .execute(),
  );
});

afterAll(async () => {
  await ownerDb.deleteFrom("PaymentMethodAudit").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("PaymentMethodAvailability").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("PaymentMethod").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Store").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("User").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Tenant").where("id", "=", tenantId).execute();
  await ownerDb.destroy();
});

describe("the Payment methods screen — as an admin", () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await cleanup?.();
    cleanup = undefined;
    localStorage.removeItem("deanpos.backoffice.paymentMethodsNoticeDismissed");
  });

  it("shows cash as Always on with no Edit, creates a method available everywhere by default, and shows no delete anywhere", async () => {
    const { container, db } = renderRoute({
      router,
      tenantId,
      userId: adminId,
      role: "admin",
      initialLocation: "/payment-methods",
    });
    cleanup = () => db.destroy();

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Payment methods" })).toBeTruthy(),
    );
    // "Cash" appears twice in the row — the Method name and the Kind — so
    // this locates the row by cell, not by a unique text match.
    await waitFor(() => expect(screen.getAllByText("Cash").length).toBeGreaterThan(0));
    const cashRow = screen.getAllByText("Cash")[0]!.closest("tr")!;
    expect(within(cashRow).getByText("All stores")).toBeTruthy();
    expect(within(cashRow).getByText("Always on")).toBeTruthy();
    expect(within(cashRow).queryByRole("button", { name: /^Edit/ })).toBeNull();
    expect(within(cashRow).queryByRole("button", { name: /^Deactivate/ })).toBeNull();

    await expectNoAxeViolations(container);

    fireEvent.click(screen.getByRole("button", { name: "Add method" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "New method" })).toBeTruthy());
    expect(document.activeElement).toBe(screen.getByLabelText("Name"));

    // Every Store is checked by default (record 054 §"Smaller calls" 4).
    await waitFor(() => expect(screen.getByLabelText("Downtown")).toBeTruthy());
    const downtownCheckbox = screen.getByLabelText("Downtown") as HTMLInputElement;
    expect(downtownCheckbox.checked).toBe(true);

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "GCash" } });
    fireEvent.click(screen.getByRole("button", { name: "Create method" }));

    await waitFor(() => expect(screen.queryByRole("heading", { name: "New method" })).toBeNull());
    await waitFor(() => expect(screen.getByText("GCash")).toBeTruthy());

    const gcashRow = screen.getByText("GCash").closest("tr")!;
    expect(within(gcashRow).getByText("Recorded")).toBeTruthy();
    expect(within(gcashRow).getByText("All stores")).toBeTruthy();
    expect(within(gcashRow).getByText("Active")).toBeTruthy();

    expect(container.textContent?.toLowerCase()).not.toMatch(/\bdelete\b|permanently/);
    await expectNoAxeViolations(container);
  });

  it("the sheet's QR upload is accessible: a labelled control, alt text on the preview, and a refused upload announces its reason (criterion 12)", async () => {
    const { db } = renderRoute({
      router,
      tenantId,
      userId: adminId,
      role: "admin",
      initialLocation: "/payment-methods",
    });
    cleanup = () => db.destroy();

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Payment methods" })).toBeTruthy(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Add method" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "New method" })).toBeTruthy());

    // The file control's visible label.
    const fileInput = screen.getByLabelText("QR image") as HTMLInputElement;
    expect(fileInput.type).toBe("file");

    // A refused upload announces its reason to a screen reader.
    const svgFile = new File(
      [new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'></svg>")],
      "qr.png",
      { type: "image/png" },
    );
    fireEvent.change(fileInput, { target: { files: [svgFile] } });
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/Only PNG and JPEG/));

    // The preview's alternative text.
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
    const pngFile = new File([pngBytes], "qr.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [pngFile] } });
    await waitFor(() =>
      expect(screen.getByAltText("The uploaded QR code for this payment method")).toBeTruthy(),
    );

    // `SheetContent` portals to `document.body`, outside any render `container`.
    await expectNoAxeViolations(document.body);
  });

  it("a QR image dropped onto the upload area previews the same as a picked one", async () => {
    const { db } = renderRoute({
      router,
      tenantId,
      userId: adminId,
      role: "admin",
      initialLocation: "/payment-methods",
    });
    cleanup = () => db.destroy();

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Payment methods" })).toBeTruthy(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Add method" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "New method" })).toBeTruthy());

    const dropZone = screen.getByLabelText("QR image").parentElement!;
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
    const pngFile = new File([pngBytes], "qr.png", { type: "image/png" });
    fireEvent.drop(dropZone, { dataTransfer: { files: [pngFile] } });

    await waitFor(() =>
      expect(screen.getByAltText("The uploaded QR code for this payment method")).toBeTruthy(),
    );

    // A dropped file the server would refuse is refused here too.
    const svgFile = new File([new TextEncoder().encode("<svg></svg>")], "qr.png", {
      type: "image/png",
    });
    fireEvent.drop(dropZone, { dataTransfer: { files: [svgFile] } });
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/Only PNG and JPEG/));
  });

  it("states plainly that a non-cash method records an amount and charges nothing", async () => {
    const { db } = renderRoute({
      router,
      tenantId,
      userId: adminId,
      role: "admin",
      initialLocation: "/payment-methods",
    });
    cleanup = () => db.destroy();

    await waitFor(() =>
      expect(screen.getByText("A new tenant starts with cash only")).toBeTruthy(),
    );
    expect(screen.getByText(/records an amount and charges\s+nothing/)).toBeTruthy();
    expect(
      screen.getByText(/never verifies that a scan against it was actually\s+paid/),
    ).toBeTruthy();
  });

  it("keeps the primer dismissed once it is closed", async () => {
    const first = renderRoute({
      router,
      tenantId,
      userId: adminId,
      role: "admin",
      initialLocation: "/payment-methods",
    });

    await waitFor(() => expect(screen.getByLabelText("Dismiss notice")).toBeTruthy());
    fireEvent.click(screen.getByLabelText("Dismiss notice"));
    expect(screen.queryByText("A new tenant starts with cash only")).toBeNull();
    await first.db.destroy();
    unmountAll();

    const second = renderRoute({
      router,
      tenantId,
      userId: adminId,
      role: "admin",
      initialLocation: "/payment-methods",
    });
    cleanup = () => second.db.destroy();

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Payment methods" })).toBeTruthy(),
    );
    expect(screen.queryByText("A new tenant starts with cash only")).toBeNull();
  });

  it("edits a method's name and availability together, in one Save", async () => {
    const localMethodId = randomUUID();
    await withTenantScope(ownerDb, tenantId, (db) =>
      db
        .insertInto("PaymentMethod")
        .values({ id: localMethodId, tenant_id: tenantId, name: "Bank transfer", kind: "recorded" })
        .execute(),
    );
    await withTenantScope(ownerDb, tenantId, (db) =>
      db
        .insertInto("PaymentMethodAvailability")
        .values({
          id: randomUUID(),
          tenant_id: tenantId,
          payment_method_id: localMethodId,
          store_id: storeId,
        })
        .execute(),
    );

    const { db } = renderRoute({
      router,
      tenantId,
      userId: adminId,
      role: "admin",
      initialLocation: "/payment-methods",
    });
    cleanup = async () => {
      await db.destroy();
      await ownerDb
        .deleteFrom("PaymentMethodAudit")
        .where("payment_method_id", "=", localMethodId)
        .execute();
      await ownerDb
        .deleteFrom("PaymentMethodAvailability")
        .where("payment_method_id", "=", localMethodId)
        .execute();
      await ownerDb.deleteFrom("PaymentMethod").where("id", "=", localMethodId).execute();
    };

    await waitFor(() => expect(screen.getByText("Bank transfer")).toBeTruthy());
    const row = screen.getByText("Bank transfer").closest("tr")!;
    fireEvent.click(within(row).getByRole("button", { name: /^Edit/ }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Edit Bank transfer" })).toBeTruthy(),
    );
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Bank Transfer (Local)" } });
    await waitFor(() => expect(screen.getByLabelText("Downtown")).toBeTruthy());
    fireEvent.click(screen.getByLabelText("Downtown"));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "Edit Bank transfer" })).toBeNull(),
    );
    await waitFor(() => expect(screen.getByText("Bank Transfer (Local)")).toBeTruthy());
    const updatedRow = screen.getByText("Bank Transfer (Local)").closest("tr")!;
    expect(within(updatedRow).getByText("None")).toBeTruthy();
  });
});
