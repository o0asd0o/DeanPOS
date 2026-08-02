import { Outlet } from "@tanstack/react-router";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "ui";

import { Nav } from "./Nav.tsx";

// Unlike apps/pos, this sidebar repeats on every screen, so the shell also
// carries a skip link and a `<nav>`. Header content and landmark count:
// .scratch/decisions/009.
//
// The mobile/desktop split stays the CSS `md:` breakpoint that issue 07 proved
// out, not `Sidebar`'s own `useIsMobile` switch — that hook calls
// `window.matchMedia`, which happy-dom (the render-test environment) does not
// implement, and a JS-driven switch is a first-paint flash record 009 rules
// out for the sibling shell. Below `md`, the pulled `Sheet` (focus trap,
// Escape, `aria-modal`, scroll lock, focus restoration) opens the nav; at and
// above `md`, a plain `<aside>` shows it inline. `Nav` itself is built from
// the pulled sidebar's context-free parts (`SidebarContent`, `SidebarGroup`,
// `sidebarMenuButtonVariants`), so `Sidebar`/`SidebarProvider` — which gate on
// `useSidebar()` — are never mounted.
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
