import { createFileRoute, notFound, redirect } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell.tsx";
import type { Role } from "@/lib/roles.ts";
import { hasAtLeastRole } from "@/lib/roles.ts";

// The one place the session guard, the must-change redirect (record 030),
// and the role gate (issue 15, record 063 §1, amended) live: every route
// under `_shell/` — current and future — is covered by construction.
//
// A destination that declares no `staticData.minRole`, or declares one the
// caller doesn't meet, is `notFound()` — never a redirect, so an undeclared
// `/` can't loop (record 063 §1).
export const Route = createFileRoute("/_shell")({
  beforeLoad: async ({ context, matches }) => {
    const me = await context.queryClient.fetchQuery(context.orpc.auth.me.queryOptions());

    if (!me.authenticated) throw redirect({ to: "/login" });
    if (me.mustChangePassword) throw redirect({ to: "/set-password" });

    const leaf = matches[matches.length - 1];
    const minRole = (leaf?.staticData as { minRole?: Role } | undefined)?.minRole;
    if (!minRole || !hasAtLeastRole(me.role, minRole)) throw notFound();
  },
  component: AppShell,
});
