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
        <header className="flex h-12 shrink-0 items-center gap-3 bg-foreground px-4 text-background">
          <span className="font-semibold">DeanPOS</span>
          <span className="text-sm text-background/70">Draft</span>
          {/* SaleWorkspace portals terminal actions here so the shell owns the header. */}
          <div className="ml-auto flex items-center gap-1">
            <span id="shell-lock-action">
              <LockButton />
            </span>
            <div id="shell-header-actions" className="flex items-center gap-1" />
          </div>
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
