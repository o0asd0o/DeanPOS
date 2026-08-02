import { createFileRoute, redirect } from "@tanstack/react-router";

import { SetPassword } from "../../features/set-password/SetPassword.tsx";

// Reached while holding a valid session (record 030) — redirects to `/`
// when the must-change flag is not set, so it is never a route with
// nothing to do, and to `/login` with no session at all.
export const Route = createFileRoute("/_gate/set-password")({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.fetchQuery(context.orpc.auth.me.queryOptions());

    if (!me.authenticated) throw redirect({ to: "/login" });
    if (!me.mustChangePassword) throw redirect({ to: "/" });
  },
  component: SetPassword,
});
