import { Outlet } from "@tanstack/react-router";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "ui";

import { Nav } from "./Nav.tsx";

// The shell frame, nav skeleton and skip link. Header content, landmark
// count and copy: .scratch/decisions/009 — the header carries exactly one
// child, same as apps/pos. The sidebar repeats on every screen, so —
// unlike apps/pos — this shell also carries a skip link and a `<nav>`.
export function AppShell() {
  return (
    <div className="flex h-dvh flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-background focus:p-2"
      >
        Skip to content
      </a>
      <header className="flex justify-between p-4">
        <span>DeanPOS</span>
      </header>
      <div className="flex flex-1 flex-col overflow-y-auto md:flex-row md:overflow-visible">
        <Sheet>
          <SheetTrigger
            className="target-min m-4 self-start md:hidden"
            aria-label="Open navigation"
          >
            ☰
          </SheetTrigger>
          <SheetContent side="left">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <Nav />
          </SheetContent>
        </Sheet>
        <aside className="hidden md:block md:w-64 md:shrink-0 md:overflow-y-auto md:border-r">
          <Nav />
        </aside>
        <main id="main-content" className="flex-1 md:overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
