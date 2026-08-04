import { randomUUID } from "node:crypto";

import { cleanup, renderRoute, screen, waitFor, within } from "api/src/test-seam-react.tsx";
import { describe, expect, it } from "vite-plus/test";

import { router } from "@/router.tsx";

const tenantId = randomUUID();

// Every `_shell` leaf path, derived from the route tree rather than
// hand-listed (issue 15 criterion 1: "every other `_shell` path,
// placeholders included").
const ALL_SHELL_PATHS = Object.keys(router.routesById)
  .filter((id) => id.startsWith("/_shell/"))
  .map((id) => (id === "/_shell/" ? "/" : id.slice("/_shell".length)));
const CASHIER_OWN = new Set(["/", "/account"]);
const OTHER_THAN_CASHIER = ALL_SHELL_PATHS.filter((path) => !CASHIER_OWN.has(path));

// What each destination actually renders once its `beforeLoad` resolves —
// the positive half of "reaches", not just the absence of the refusal.
// `waitFor` runs its callback synchronously on entry, so a negative
// assertion (`queryByText(notFound).toBeNull()`) passes at t=0, before
// `auth.me` resolves, and never proves the route rendered at all.
const HEADING_BY_PATH: Record<string, string> = {
  "/account": "Account",
  "/stores": "Stores",
  "/employees": "Employees",
  "/reports/discounts-overrides": "Discounts & overrides",
  "/devices": "Devices",
  "/payment-methods": "Payment methods",
  "/roster": "Roster",
  "/catalog": "Catalog",
  "/reports/summary": "Summary",
};

type RenderResult = ReturnType<typeof renderRoute>;

// Scoped to `<main>` — a nav link and the page's own heading can share text
// (e.g. "Stores" in both the sidebar and its `<h1>`), and a `Placeholder`'s
// title isn't a heading element at all.
async function expectRendered(location: string, { container, db }: RenderResult): Promise<void> {
  const main = () => within(container.querySelector("main")!);
  if (location === "/") {
    const { message } = await db.selectFrom("Ping").select("message").executeTakeFirstOrThrow();
    await waitFor(() => expect(main().getByText(message)).toBeTruthy());
    return;
  }
  const heading = HEADING_BY_PATH[location]!;
  await waitFor(() => expect(main().getByText(heading)).toBeTruthy());
}

// `_shell`'s `beforeLoad` (issue 15, record 063 §1): `notFound()` on a
// missing or too-low `staticData.minRole`, never a redirect.
describe("_shell refuses by default", () => {
  it("a cashier reaches / and /account, and gets NotFoundState on every other _shell path", async () => {
    for (const location of ["/", "/account"]) {
      const render = renderRoute({ router, tenantId, role: "cashier", initialLocation: location });
      const { db } = render;
      await expectRendered(location, render);
      await db.destroy();
      cleanup();
    }

    for (const location of OTHER_THAN_CASHIER) {
      const { db } = renderRoute({ router, tenantId, role: "cashier", initialLocation: location });
      await waitFor(() => expect(screen.getByText("That page doesn’t exist.")).toBeTruthy());
      await db.destroy();
      cleanup();
    }
  });

  it(
    "a manager reaches /, /account, /stores, /employees, /reports/discounts-overrides, and gets NotFoundState on /devices, /payment-methods, and a placeholder",
    { timeout: 20_000 },
    async () => {
      for (const location of [
        "/",
        "/account",
        "/stores",
        "/employees",
        "/reports/discounts-overrides",
      ]) {
        const render = renderRoute({
          router,
          tenantId,
          role: "manager",
          initialLocation: location,
        });
        const { db } = render;
        await expectRendered(location, render);
        await db.destroy();
        cleanup();
      }

      for (const location of ["/devices", "/payment-methods", "/roster"]) {
        const { db } = renderRoute({
          router,
          tenantId,
          role: "manager",
          initialLocation: location,
        });
        await waitFor(() => expect(screen.getByText("That page doesn’t exist.")).toBeTruthy());
        await db.destroy();
        cleanup();
      }
    },
  );

  it(
    "an admin reaches every declared route, placeholders included",
    { timeout: 20_000 },
    async () => {
      for (const location of [
        "/",
        "/account",
        "/stores",
        "/employees",
        "/reports/discounts-overrides",
        "/devices",
        "/payment-methods",
        "/roster",
        "/catalog",
        "/reports/summary",
      ]) {
        const render = renderRoute({ router, tenantId, role: "admin", initialLocation: location });
        const { db } = render;
        await expectRendered(location, render);
        await db.destroy();
        cleanup();
      }
    },
  );

  // The default itself, not just the declarations: a real registered route
  // with its `staticData` removed is refused for `admin` too, through the
  // full router — not a hand-built `beforeLoad` call. Demonstrated and
  // reverted (issue 15 acceptance criterion 7).
  it(
    "refuses admin outright when a route's staticData is removed, demonstrated and reverted",
    { timeout: 15_000 },
    async () => {
      const options = router.routesById["/_shell/catalog"].options as { staticData?: unknown };
      const original = options.staticData;
      options.staticData = undefined;

      try {
        const { db } = renderRoute({
          router,
          tenantId,
          role: "admin",
          initialLocation: "/catalog",
        });
        await waitFor(() => expect(screen.getByText("That page doesn’t exist.")).toBeTruthy());
        await db.destroy();
        cleanup();
      } finally {
        options.staticData = original;
      }

      const render = renderRoute({ router, tenantId, role: "admin", initialLocation: "/catalog" });
      const { db } = render;
      await expectRendered("/catalog", render);
      await db.destroy();
      cleanup();
    },
  );
});
