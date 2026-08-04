import { describe, expect, it } from "vite-plus/test";

import { NAV_GROUPS } from "@/components/helpers.ts";
import type { Role } from "@/lib/roles.ts";
import { router } from "@/router.tsx";

// Two hand-written lists of the same fact drift (issue 15, record 063 §5):
// every `NAV_GROUPS` entry's `minRole` must equal the `staticData.minRole`
// of the route it points at, and that route must exist.
describe("NAV_GROUPS matches the routes it points at", () => {
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      it(`${item.to}'s minRole matches its route's staticData`, () => {
        const route = router.routesById[`/_shell${item.to}` as keyof typeof router.routesById];
        expect(route, `no route registered for ${item.to}`).toBeTruthy();
        const staticData = route!.options.staticData as { minRole?: Role } | undefined;
        expect(staticData?.minRole).toBe(item.minRole);
      });
    }
  }
});
