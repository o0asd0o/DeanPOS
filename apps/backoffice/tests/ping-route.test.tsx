import { randomUUID } from "node:crypto";

import { expectNoAxeViolations, renderRoute, screen, waitFor } from "api/src/test-seam-react.tsx";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { router } from "../src/router.tsx";

// The shell's routes require a signed-in session since issue 03 —
// `renderRoute`'s `tenantId` renders as that Tenant's session.
const tenantId = randomUUID();

describe("the back-office shell's ping route", () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await cleanup?.();
    cleanup = undefined;
  });

  it("shows the pending line, then the ping value read from the lane database", async () => {
    const { container, db } = renderRoute({ router, tenantId });
    cleanup = () => db.destroy();

    // TanStack Router's initial match runs in a layout effect after the first
    // paint, so the route (and its pending state) only appears one tick later.
    await waitFor(() => expect(screen.getByRole("status")).toBeTruthy());
    expect(screen.getByRole("status").textContent).toBe("Loading…");
    await expectNoAxeViolations(container);

    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());

    // The page's one `<header>` is the sidebar's, not a full-width bar (record 021),
    // so issue 07's QA-round-1 assertion that the `☰` sits inside it no longer holds.
    // What that round actually bought — a single chrome row before `<main>` at 390 —
    // is now structural: the trigger's row is `md:hidden` and there is nothing above it.
    expect(container.querySelectorAll("header")).toHaveLength(1);
    const header = container.querySelector("header");
    expect(header?.textContent).toContain("DeanPOS");
    expect(header?.closest('[data-slot="sidebar"]')).toBeTruthy();
    expect(screen.getByLabelText("Open navigation")).toBeTruthy();
    expect(container.querySelectorAll("main")).toHaveLength(1);
    expect(container.querySelector("main")?.id).toBe("main-content");

    expect(container.querySelectorAll("nav")).toHaveLength(1);
    const nav = container.querySelector("nav");
    expect(nav?.getAttribute("aria-label")).toBe("Primary");
    const navText = nav?.textContent ?? "";
    expect(navText.indexOf("Reports")).toBeLessThan(navText.indexOf("Catalog"));

    // Every entry is a real link to a real route now (record 020), so the row is
    // an anchor carrying the sidebar's pill classes — not an inert span.
    const orders = screen.getByText("Orders").closest("a");
    expect(orders?.getAttribute("data-slot")).toBe("sidebar-menu-button");
    expect(orders?.getAttribute("href")).toBe("/reports/orders");

    const skipLink = screen.getByText("Skip to content") as HTMLAnchorElement;
    expect(skipLink.getAttribute("href")).toBe("#main-content");
    expect(container.querySelector("main")?.getAttribute("tabindex")).toBe("-1");

    const { message } = await db.selectFrom("Ping").select("message").executeTakeFirstOrThrow();
    expect(screen.getByText(message)).toBeTruthy();

    await expectNoAxeViolations(container);
  });

  // `_shell`'s own session check (`auth.me`) is a database round trip too,
  // so an unreachable database fails before the shell mounts — no sidebar.
  it("shows a legible error state when the API cannot be reached, with no chrome it cannot vouch for", async () => {
    const { container, db } = renderRoute({
      router,
      tenantId,
      databaseUrl: "postgresql://nobody:wrongpassword@127.0.0.1:1/does-not-exist",
    });
    cleanup = () => db.destroy();

    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());

    const retry = screen.getByRole("button", { name: "Try again" }) as HTMLButtonElement;
    expect(retry.disabled).toBe(false);

    const alertText = screen.getByRole("alert").textContent ?? "";
    expect(alertText).not.toMatch(/\d{3}|http|Error:|ECONNREFUSED|wrongpassword/i);

    await expectNoAxeViolations(container);
  });

  it("with no session at all, redirects to the sign-in screen instead of rendering the shell", async () => {
    const { container, db } = renderRoute({ router });
    cleanup = () => db.destroy();

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "DeanPOS back-office" })).toBeTruthy(),
    );
    expect(container.querySelectorAll("header")).toHaveLength(0);
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByLabelText("Password")).toBeTruthy();

    await expectNoAxeViolations(container);
  });
});
