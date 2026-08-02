import { randomUUID } from "node:crypto";

import {
  expectNoAxeViolations,
  fireEvent,
  renderRoute,
  screen,
  waitFor,
} from "api/src/test-seam-react.tsx";
import { describe, expect, it } from "vite-plus/test";

import { router } from "../src/router.tsx";

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
    // floor; the ceiling is server-only, which is exactly finding 1's bug.
    expect(
      screen.getByText(
        "At least 15 characters. Any characters, including spaces — there are no other rules.",
      ),
    ).toBeTruthy();
    expect(newPassword.getAttribute("minlength")).toBe("15");
    expect(confirmPassword.getAttribute("minlength")).toBe("15");
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
    // refused only by the server, which is finding 1's bug: 129 characters.
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
});
