import { randomUUID } from "node:crypto";

import { isNotFound } from "@tanstack/react-router";
import { cleanup, renderRoute, screen, waitFor } from "api/src/test-seam-react.tsx";
import { describe, expect, it } from "vite-plus/test";

import { Route as ShellRoute } from "@/routes/_shell.tsx";
import { router } from "@/router.tsx";

const tenantId = randomUUID();

// `_shell`'s `beforeLoad` (issue 15, record 063 §1): `notFound()` on a
// missing or too-low `staticData.minRole`, never a redirect.
describe("_shell refuses by default", () => {
  it("a cashier reaches / and /account, and gets NotFoundState on every other _shell path", async () => {
    for (const location of ["/", "/account"]) {
      const { db } = renderRoute({ router, tenantId, role: "cashier", initialLocation: location });
      await waitFor(() => expect(screen.queryByText("That page doesn’t exist.")).toBeNull());
      await db.destroy();
      cleanup();
    }

    for (const location of [
      "/stores",
      "/employees",
      "/reports/discounts-overrides",
      "/devices",
      "/payment-methods",
      "/roster",
      "/reports/drawer-sessions",
    ]) {
      const { db } = renderRoute({ router, tenantId, role: "cashier", initialLocation: location });
      await waitFor(() => expect(screen.getByText("That page doesn’t exist.")).toBeTruthy());
      await db.destroy();
      cleanup();
    }
  });

  it("a manager reaches /, /account, /stores, /employees, /reports/discounts-overrides, and gets NotFoundState on /devices, /payment-methods, and a placeholder", async () => {
    for (const location of [
      "/",
      "/account",
      "/stores",
      "/employees",
      "/reports/discounts-overrides",
    ]) {
      const { db } = renderRoute({ router, tenantId, role: "manager", initialLocation: location });
      await waitFor(() => expect(screen.queryByText("That page doesn’t exist.")).toBeNull());
      await db.destroy();
      cleanup();
    }

    for (const location of ["/devices", "/payment-methods", "/roster"]) {
      const { db } = renderRoute({ router, tenantId, role: "manager", initialLocation: location });
      await waitFor(() => expect(screen.getByText("That page doesn’t exist.")).toBeTruthy());
      await db.destroy();
      cleanup();
    }
  });

  it("an admin reaches every declared route, placeholders included", async () => {
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
      const { db } = renderRoute({ router, tenantId, role: "admin", initialLocation: location });
      await waitFor(() => expect(screen.queryByText("That page doesn’t exist.")).toBeNull());
      await db.destroy();
      cleanup();
    }
  });

  // The default itself, not just the declarations: a leaf with no
  // `staticData.minRole` at all is refused even for `admin`.
  it("refuses admin outright when the destination declares no minRole", async () => {
    const fakeMatch = { staticData: {} } as Parameters<
      NonNullable<typeof ShellRoute.options.beforeLoad>
    >[0]["matches"][number];

    const beforeLoad = ShellRoute.options.beforeLoad!;
    let thrown: unknown;
    try {
      await beforeLoad({
        context: {
          queryClient: {
            fetchQuery: async () => ({
              authenticated: true,
              role: "admin",
              mustChangePassword: false,
            }),
          },
          orpc: { auth: { me: { queryOptions: () => ({}) } } },
        },
        matches: [fakeMatch],
      } as unknown as Parameters<typeof beforeLoad>[0]);
    } catch (error) {
      thrown = error;
    }
    expect(isNotFound(thrown)).toBe(true);
  });
});
