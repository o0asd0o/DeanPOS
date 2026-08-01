import { createRootRouteWithContext } from "@tanstack/react-router";

import { AppShell } from "../components/AppShell.tsx";
import type { RouterContext } from "../lib/router-context.ts";

export const Route = createRootRouteWithContext<RouterContext>()({
  component: AppShell,
});
