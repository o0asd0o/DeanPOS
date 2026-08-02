import { createFileRoute } from "@tanstack/react-router";

import { AuthLayout } from "@/components/AuthLayout.tsx";

// The unauthenticated frame — no sidebar, no nav (record 030: the mock
// draws neither, and rendering them to someone not signed in is a false
// affordance). `/login` and `/set-password` are its only two screens.
export const Route = createFileRoute("/_gate")({
  component: AuthLayout,
});
