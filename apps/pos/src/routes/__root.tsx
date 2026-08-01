import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";

import type { RouterContext } from "../lib/router-context.ts";

// The frame and the header. ADR-0009: routes stay thin; .scratch/decisions/009
// fixes this exact layout, and it is one of the two files a chrome-copy edit touches.
export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});

function RootLayout() {
  return (
    <div className="flex h-dvh flex-col">
      <header className="flex justify-between p-4">
        <span>DeanPOS</span>
      </header>
      <div className="flex flex-1 flex-col overflow-y-auto md:flex-row md:overflow-visible">
        <main id="main-content" className="flex-1 md:overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
