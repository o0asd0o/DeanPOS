import { randomUUID } from "node:crypto";

import {
  expectNoAxeViolations,
  fireEvent,
  renderRoute,
  screen,
  waitFor,
  within,
} from "api/src/test-seam-react.tsx";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { router } from "@/router.tsx";

// Record 048: the content column's bar. The page's one banner stays the
// sidebar's (record 021), which is why this row is a `<div>`.
const tenantId = randomUUID();

// Radix opens a menu on pointerdown, which happy-dom's `click` does not imply
// (record 042).
const openMenu = async (name: string) => {
  const trigger = await waitFor(() => screen.getByRole("button", { name }));
  fireEvent.pointerDown(trigger, { button: 0, pointerType: "mouse" });
  return waitFor(() => screen.getByRole("menu"));
};

describe("the back-office header", () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await cleanup?.();
    cleanup = undefined;
  });

  it("carries a search field, notifications and the account menu, and adds no second banner", async () => {
    const { container, db } = renderRoute({ router, tenantId });
    cleanup = () => db.destroy();

    const search = (await waitFor(() => screen.getByLabelText("Search"))) as HTMLInputElement;
    expect(search.type).toBe("search");
    expect(container.querySelector('[role="search"]')).toBeTruthy();

    expect(screen.getByRole("button", { name: "Notifications" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Account" })).toBeTruthy();

    expect(container.querySelectorAll("header")).toHaveLength(1);
    expect(container.querySelector("header")?.closest('[data-slot="sidebar"]')).toBeTruthy();

    await expectNoAxeViolations(container);
  });

  it("states that there are no notifications rather than implying one is loading", async () => {
    const { db } = renderRoute({ router, tenantId });
    cleanup = () => db.destroy();

    const menu = await openMenu("Notifications");
    expect(within(menu).getByText("Nothing yet.")).toBeTruthy();
  });

  it("offers Settings from the account menu", async () => {
    const { db } = renderRoute({ router, tenantId });
    cleanup = () => db.destroy();

    const menu = await openMenu("Account");
    const settings = within(menu).getByRole("menuitem", { name: "Settings" });
    expect(settings.getAttribute("href")).toBe("/settings");
  });
});
