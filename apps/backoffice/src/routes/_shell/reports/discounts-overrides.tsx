import { createFileRoute, redirect } from "@tanstack/react-router";

import { Overrides } from "@/features/overrides/Overrides.tsx";

// Thin: wires the route to the feature and nothing else (ADR-0009).
// `manager`-or-above only (record 060 Q5, devices.tsx's exact gate) — the
// handler enforces criterion 8's Store scoping, this is navigation only.
export const Route = createFileRoute("/_shell/reports/discounts-overrides")({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.fetchQuery(context.orpc.auth.me.queryOptions());
    if (!me.authenticated || me.role === "cashier") throw redirect({ to: "/" });
  },
  component: Overrides,
});
