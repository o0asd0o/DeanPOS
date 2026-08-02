import { expectNoAxeViolations, renderRoute, screen, waitFor } from "api/src/test-seam-react.tsx";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { router } from "../src/router.tsx";

describe("the back-office shell's ping route", () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await cleanup?.();
    cleanup = undefined;
  });

  it("shows the pending line, then the ping value read from the lane database", async () => {
    const { container, db } = renderRoute({ router });
    cleanup = () => db.destroy();

    // TanStack Router's initial match runs in a layout effect after the first
    // paint, so the route (and its pending state) only appears one tick later.
    await waitFor(() => expect(screen.getByRole("status")).toBeTruthy());
    expect(screen.getByRole("status").textContent).toBe("Loading…");
    await expectNoAxeViolations(container);

    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());

    expect(container.querySelectorAll("header")).toHaveLength(1);
    const header = container.querySelector("header");
    expect(header?.textContent).toContain("DeanPOS");
    expect(header?.querySelector('[aria-label="Open navigation"]')).toBeTruthy();
    expect(container.querySelectorAll("main")).toHaveLength(1);
    expect(container.querySelector("main")?.id).toBe("main-content");

    expect(container.querySelectorAll("nav")).toHaveLength(1);
    const nav = container.querySelector("nav");
    expect(nav?.getAttribute("aria-label")).toBe("Primary");
    const navText = nav?.textContent ?? "";
    expect(navText.indexOf("Reports")).toBeLessThan(navText.indexOf("Catalog"));

    const orders = screen.getByText("Orders");
    expect(orders.getAttribute("data-slot")).toBe("sidebar-menu-button");
    expect(orders.className).toContain("pointer-events-none");

    const skipLink = screen.getByText("Skip to content") as HTMLAnchorElement;
    expect(skipLink.getAttribute("href")).toBe("#main-content");
    expect(container.querySelector("main")?.getAttribute("tabindex")).toBe("-1");

    const { message } = await db.selectFrom("Ping").select("message").executeTakeFirstOrThrow();
    expect(screen.getByText(message)).toBeTruthy();

    await expectNoAxeViolations(container);
  });

  it("shows a legible error state, with header intact and retry enabled, when the API cannot be reached", async () => {
    const { container, db } = renderRoute({
      router,
      databaseUrl: "postgresql://nobody:wrongpassword@127.0.0.1:1/does-not-exist",
    });
    cleanup = () => db.destroy();

    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());

    expect(container.querySelectorAll("header")).toHaveLength(1);
    const retry = screen.getByRole("button", { name: "Try again" }) as HTMLButtonElement;
    expect(retry.disabled).toBe(false);

    const alertText = screen.getByRole("alert").textContent ?? "";
    expect(alertText).not.toMatch(/\d{3}|http|Error:|ECONNREFUSED|wrongpassword/i);

    await expectNoAxeViolations(container);
  });
});
