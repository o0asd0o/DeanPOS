import { Outlet } from "@tanstack/react-router";

// The shell frame and header. What renders here and why: .scratch/decisions/009.
export function AppShell() {
  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <header className="flex justify-between border-b border-border p-4">
        <span className="text-lg font-bold">DeanPOS</span>
      </header>
      <div className="flex flex-1 flex-col overflow-y-auto md:flex-row md:overflow-visible">
        <main id="main-content" className="flex-1 md:overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
