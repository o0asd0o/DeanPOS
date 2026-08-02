import { createFileRoute, redirect } from "@tanstack/react-router";

import { AppShell } from "../components/AppShell.tsx";

// The one place the session guard and the must-change redirect live
// (record 030): every route under `_shell/` — current and future — is
// covered by construction, because this is where they all nest.
export const Route = createFileRoute("/_shell")({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.fetchQuery(context.orpc.auth.me.queryOptions());

    if (!me.authenticated) throw redirect({ to: "/login" });
    if (me.mustChangePassword) throw redirect({ to: "/set-password" });
  },
  component: AppShell,
});
