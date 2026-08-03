import { randomUUID } from "node:crypto";

import { fireEvent, renderRoute, screen, waitFor, within } from "api/src/test-seam-react.tsx";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { router } from "@/router.tsx";

// Issue 03 round 2: auth.signOut existed and was tested server-side, but
// nothing in this app called it. It hangs off the header's account menu since
// record 048, not the sidebar footer.
const tenantId = randomUUID();

// Radix opens a menu on pointerdown, which happy-dom's `click` does not imply
// (record 042).
const openAccountMenu = async () => {
  const trigger = await waitFor(() => screen.getByRole("button", { name: "Account" }));
  fireEvent.pointerDown(trigger, { button: 0, pointerType: "mouse" });
  return waitFor(() => screen.getByRole("menu"));
};

describe("the header's account menu", () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await cleanup?.();
    cleanup = undefined;
  });

  // Runs before the confirming case: `router` is a module singleton, so once a
  // test signs out it stays on /login for the rest of the file.
  it("cancelling closes the dialog and stays in the shell", async () => {
    const { db } = renderRoute({ router, tenantId });
    cleanup = () => db.destroy();

    const menu = await openAccountMenu();
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Sign out" }));

    const dialog = await waitFor(() => screen.getByRole("dialog"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.queryByRole("heading", { name: "DeanPOS back-office" })).toBeNull();
  });

  it("confirms first, then signs out and returns to the sign-in screen", async () => {
    const { container, db } = renderRoute({ router, tenantId });
    cleanup = () => db.destroy();

    const menu = await openAccountMenu();
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Sign out" }));

    const dialog = await waitFor(() => screen.getByRole("dialog"));
    expect(within(dialog).getByText("Are you sure you want to logout?")).toBeTruthy();

    fireEvent.click(within(dialog).getByRole("button", { name: "Sign out" }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "DeanPOS back-office" })).toBeTruthy(),
    );
    expect(container.querySelectorAll("header")).toHaveLength(0);
  });
});
