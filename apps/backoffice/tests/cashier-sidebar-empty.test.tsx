import { randomUUID } from "node:crypto";

import { renderRoute, waitFor, within } from "api/src/test-seam-react.tsx";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { NAV_GROUPS } from "@/components/helpers.ts";
import { router } from "@/router.tsx";

// Criterion 2 (issue 15, record 063 §5): a cashier's sidebar renders no
// `NAV_GROUPS` entry and no empty group heading — `NavGroup.tsx`'s
// zero-items guard, exercised through a real render rather than restated.
const tenantId = randomUUID();

describe("a cashier's sidebar", () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await cleanup?.();
    cleanup = undefined;
  });

  it("renders no NAV_GROUPS entry and no empty group heading", async () => {
    const { container, db } = renderRoute({
      router,
      tenantId,
      role: "cashier",
      initialLocation: "/",
    });
    cleanup = () => db.destroy();

    await waitFor(() => expect(container.querySelector("nav")).toBeTruthy());
    const nav = within(container.querySelector("nav")!);

    for (const group of NAV_GROUPS) {
      expect(nav.queryByRole("heading", { name: group.label })).toBeNull();
      for (const item of group.items) {
        expect(nav.queryByText(item.label)).toBeNull();
      }
    }
  });
});
