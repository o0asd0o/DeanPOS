import { createFileRoute, redirect } from "@tanstack/react-router";

import { Devices } from "@/features/devices/Devices.tsx";

// Thin: wires the route to the feature and nothing else (ADR-0009). `admin`
// only — the route itself refuses (record 046 §4, record 056).
export const Route = createFileRoute("/_shell/devices")({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.fetchQuery(context.orpc.auth.me.queryOptions());
    if (!me.authenticated || me.role !== "admin") throw redirect({ to: "/" });
  },
  component: Devices,
});
