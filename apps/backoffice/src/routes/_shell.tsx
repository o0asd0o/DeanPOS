import { createFileRoute, notFound, redirect } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell.tsx";
import type { Role } from "@/lib/roles.ts";
import { hasAtLeastRole } from "@/lib/roles.ts";

// Session guard, must-change redirect, and the role gate — every route
// under `_shell/` is covered by construction. Refusal is `notFound()`,
// never a redirect. Record 063 §1.
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
