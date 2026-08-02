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

    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "password one" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "password two" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.getByRole("alert").textContent).toBe("The two passwords do not match");
    expect(screen.getByLabelText("Confirm new password").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByLabelText("New password").getAttribute("aria-invalid")).not.toBe("true");

    await expectNoAxeViolations(container);
    await db.destroy();
  });
});
