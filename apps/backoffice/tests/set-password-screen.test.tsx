import { randomUUID } from "node:crypto";

import {
  expectNoAxeViolations,
  fireEvent,
  renderRoute,
  screen,
  waitFor,
} from "api/src/test-seam-react.tsx";
import { createTestSeam } from "api/src/test-seam.ts";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { router } from "@/router.tsx";

const seam = createTestSeam();
const email = `set-password-screen-${randomUUID()}@set-password.test`;
let admin: { tenantId: string; userId: string };

beforeAll(async () => {
  const provisioned = await seam.actors
    .asPlatformAdmin(randomUUID())
    .client.platformAdmin.provisionTenant({
      tenantName: "Set-password Screen Tenant",
      adminEmail: email,
      adminPassword: "correct horse battery staple",
    });
  if (!provisioned) throw new Error("provisionTenant refused");
  admin = provisioned;
});

afterAll(async () => {
  await seam.db.destroy();
});

// The must-change flag is what the two guards branch on, so it has to change
// under the screen the way a real session's does — before the save it is set,
// after the save it is not.
function sessionCarryingFetch(): typeof fetch {
  const asAdmin = (mustChangePassword: boolean) =>
    seam.actors.asTenant(admin.tenantId, {
      userId: admin.userId,
      email,
      role: "admin",
      mustChangePassword,
    });
  const changed = asAdmin(false);
  let current = asAdmin(true);

  return (async (request: Request, init?: RequestInit) => {
    const response = await current.app.request(request, init);
    if (request.url.endsWith("/auth/setPassword") && response.status === 200) current = changed;
    return response;
  }) as unknown as typeof fetch;
}

// Record 030's `/set-password` structure. The redirect *into* it is proven
// server-side in apps/api/tests/forced-password-change.test.ts; this file
// is the screen's own states.
describe("the set-password screen", () => {
  it("renders the mock-derived structure, with no sidebar and no header", async () => {
    const { container, db } = renderRoute({
      router,
      initialLocation: "/set-password",
      tenantId: randomUUID(),
      mustChangePassword: true,
    });

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Set a new password" })).toBeTruthy(),
    );

    expect(container.querySelectorAll("header")).toHaveLength(0);
    expect(container.querySelectorAll("nav")).toHaveLength(0);
    expect(
      screen.getByText("Your password was set by an administrator. Choose a new one to continue."),
    ).toBeTruthy();

    const newPassword = screen.getByLabelText("New password") as HTMLInputElement;
    const confirmPassword = screen.getByLabelText("Confirm new password") as HTMLInputElement;
    expect(newPassword.type).toBe("password");
    expect(newPassword.getAttribute("autocomplete")).toBe("new-password");
    expect(confirmPassword.type).toBe("password");
    expect(confirmPassword.getAttribute("autocomplete")).toBe("new-password");

    // Record 032: the hint, minLength on both inputs, and — deliberately —
    // no maxLength. The browser can never disagree with the server on the
    // floor; the ceiling is server-only.
    expect(
      screen.getByText(
        "At least 8 characters. Any characters, including spaces — there are no other rules.",
      ),
    ).toBeTruthy();
    expect(newPassword.getAttribute("minlength")).toBe("8");
    expect(confirmPassword.getAttribute("minlength")).toBe("8");
    expect(newPassword.getAttribute("maxlength")).toBeNull();
    expect(confirmPassword.getAttribute("maxlength")).toBeNull();

    expect(screen.getByRole("button", { name: "Save and continue" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();

    await expectNoAxeViolations(container);
    await db.destroy();
  });

  it("a mismatched confirm password shows the mismatch sentence and marks only the confirm field", async () => {
    const { container, db } = renderRoute({
      router,
      initialLocation: "/set-password",
      tenantId: randomUUID(),
      mustChangePassword: true,
    });

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Set a new password" })).toBeTruthy(),
    );

    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "the first long password" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "the second long password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.getByRole("alert").textContent).toBe("The two passwords do not match");
    expect(screen.getByLabelText("Confirm new password").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByLabelText("New password").getAttribute("aria-invalid")).not.toBe("true");

    await expectNoAxeViolations(container);
    await db.destroy();
  });

  it("a password over the server maximum shows the server's rejection message, not the network-error screen", async () => {
    const { container, db } = renderRoute({
      router,
      initialLocation: "/set-password",
      tenantId: randomUUID(),
      mustChangePassword: true,
    });

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Set a new password" })).toBeTruthy(),
    );

    // No client maxLength (record 032) — this clears the browser and is
    // refused only by the server: 129 characters.
    const tooLong = "a".repeat(129);
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: tooLong } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: tooLong } });
    fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.getByRole("alert").textContent).toBe("Password must be 128 characters or fewer");
    expect(screen.queryByText("Can’t reach the server.")).toBeNull();

    await expectNoAxeViolations(container);
    await db.destroy();
  });

  // This screen's own guard caches an `auth.me` still carrying the flag the
  // save clears, so without an invalidation `_shell` reads it and sends the
  // user straight back here.
  it("a saved password leaves the gate rather than bouncing back to this screen", async () => {
    const { container, db } = renderRoute({
      router,
      initialLocation: "/set-password",
      fetch: sessionCarryingFetch(),
    });

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Set a new password" })).toBeTruthy(),
    );

    const newPassword = "a brand new long password";
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: newPassword } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: newPassword },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));

    // The shell draws a nav; the gate draws none.
    await waitFor(() => expect(container.querySelector("nav")).toBeTruthy());
    expect(screen.queryByRole("heading", { name: "Set a new password" })).toBeNull();

    await db.destroy();
  });
});
