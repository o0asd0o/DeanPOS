import { Outlet } from "@tanstack/react-router";
import { Button } from "ui";

import { ActingUserProvider, useActingUser } from "@/lib/acting-user.tsx";

function LockButton() {
  const { actingUser, setActingUser } = useActingUser();
  if (actingUser === null) return null;
  return (
    <Button variant="outline" size="sm" onClick={() => setActingUser(null)}>
      Lock
    </Button>
  );
}

// The shell frame and header. What renders here and why: .scratch/decisions/009.
// ActingUserProvider lives here, not main.tsx (issue 10) — every rendered
// route sits under this one root, so every test that renders a route gets
// the provider without repeating it.
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
