import { createFileRoute, notFound } from "@tanstack/react-router";

import { Settings } from "@/features/settings/Settings.tsx";

// `admin`-only, financial controls (issue 07, record 046 §4): the nav entry
// is hidden for `manager`/`cashier` (presentation, Nav.tsx), but this guard
// is the actual enforcement — a direct navigation to the URL still refuses,
// server-side, the same not-found shape every other refusal in this app
// uses.
export const Route = createFileRoute("/_shell/settings")({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.fetchQuery(context.orpc.auth.me.queryOptions());
    if (me.authenticated !== true || me.role !== "admin") throw notFound();
  },
  component: Settings,
});
