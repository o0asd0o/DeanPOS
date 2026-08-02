import { createRootRouteWithContext } from "@tanstack/react-router";

import type { RouterContext } from "@/lib/router-context.ts";

// No `component` — TanStack Router renders an `<Outlet />` for a route that
// declares neither (record 010). `_shell` and `_gate` are the two frames a
// screen can render inside; the root itself renders no chrome.
export const Route = createRootRouteWithContext<RouterContext>()({});
