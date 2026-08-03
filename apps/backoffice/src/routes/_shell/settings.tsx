import { createFileRoute, notFound } from "@tanstack/react-router";

import { Settings } from "@/features/settings/Settings.tsx";

// `admin`-only, financial controls (record 046 §4). The nav hides the entry
// for other roles; this guard is the actual enforcement.
export const Route = createFileRoute("/_shell/settings")({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.fetchQuery(context.orpc.auth.me.queryOptions());
    if (me.authenticated !== true || me.role !== "admin") throw notFound();
  },
  component: Settings,
});
