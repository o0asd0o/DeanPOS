import { Outlet } from "@tanstack/react-router";

import { ActingUserProvider } from "@/lib/acting-user.tsx";
import { LockButton } from "./LockButton.tsx";

// The shell frame and header: .scratch/decisions/009. ActingUserProvider
// lives here, not main.tsx (issue 10) — every rendered route sits under
// this one root, so a route test gets the provider without repeating it.
export function AppShell() {
  return (
    <ActingUserProvider>
      <div className="flex h-dvh flex-col bg-background text-foreground">
        <header className="flex justify-between p-4">
          <span className="text-lg font-bold">DeanPOS</span>
          <LockButton />
        </header>
        <div className="flex flex-1 flex-col overflow-y-auto md:flex-row md:overflow-visible">
          <main id="main-content" className="flex-1 md:overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </ActingUserProvider>
  );
}
