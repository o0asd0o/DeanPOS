import { Outlet } from "@tanstack/react-router";

import { ActingUserProvider } from "@/lib/acting-user.tsx";

// The shell frame: .scratch/decisions/009. ActingUserProvider lives here, not
// main.tsx (issue 10) — every rendered route sits under this one root, so a
// route test gets the provider without repeating it.
export function AppShell() {
  return (
    <ActingUserProvider>
      <div className="flex h-dvh flex-col bg-background text-foreground">
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-visible">
          <main id="main-content" className="flex-1 md:overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </ActingUserProvider>
  );
}
