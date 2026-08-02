import { Outlet } from "@tanstack/react-router";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "ui";

import { Nav } from "./Nav.tsx";

// Unlike apps/pos, this sidebar repeats on every screen, so the shell also
// carries a skip link and a `<nav>`. Header content and landmark count:
// .scratch/decisions/009.
export function AppShell() {
  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-background focus:p-2"
      >
        Skip to content
      </a>
      <header className="flex justify-between border-b border-border p-4">
        <span className="text-lg font-bold">DeanPOS</span>
      </header>
      <div className="flex flex-1 flex-col overflow-y-auto md:flex-row md:overflow-visible">
        <Sheet>
          <SheetTrigger
            className="tap-target m-4 self-start md:hidden"
            aria-label="Open navigation"
          >
            ☰
          </SheetTrigger>
          <SheetContent side="left" className="p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <Nav />
          </SheetContent>
        </Sheet>
        {/* Not `Sidebar`'s own offcanvas: it gates on `useSidebar()` -> `useIsMobile()`
            -> `window.matchMedia`, unsupported in the happy-dom render-test env, and a
            JS-driven switch is the first-paint flash record 009 rules out. */}
        <aside className="hidden bg-sidebar text-sidebar-foreground md:block md:w-64 md:shrink-0 md:overflow-y-auto md:border-r md:border-border">
          <Nav />
        </aside>
        <main id="main-content" tabIndex={-1} className="flex-1 md:overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
