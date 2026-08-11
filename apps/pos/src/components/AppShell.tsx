import { Outlet } from "@tanstack/react-router";

import { ActingUserProvider } from "@/lib/acting-user.tsx";
import { LockButton } from "@/components/LockButton.tsx";

// The shell frame: .scratch/decisions/009. ActingUserProvider lives here, not
// main.tsx (issue 10) — every rendered route sits under this one root, so a
// route test gets the provider without repeating it.
export function AppShell() {
  return (
    <ActingUserProvider>
      <div className="flex h-dvh flex-col bg-background text-foreground">
        <header className="flex h-12 shrink-0 items-stretch">
          <div
            id="shell-default-header"
            className="flex min-w-0 flex-1 items-center justify-between gap-2 border-b border-border bg-card px-3 text-foreground"
          >
            <span className="font-semibold">DeanPOS</span>
            <span>
              <LockButton />
            </span>
          </div>
          <div
            id="shell-sale-header"
            hidden
            className="flex min-w-0 flex-1 items-center gap-2 bg-foreground px-3 text-background"
          />
        </header>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-visible">
          <main id="main-content" className="flex-1 md:overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </ActingUserProvider>
  );
}
