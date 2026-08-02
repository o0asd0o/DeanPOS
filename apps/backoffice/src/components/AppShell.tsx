import { Outlet } from "@tanstack/react-router";
import { Sheet, SheetContent, SheetTitle, SheetTrigger, Sidebar, SidebarProvider } from "ui";

import { Nav } from "./Nav.tsx";
import { SidebarBrand } from "./SidebarBrand.tsx";

// Unlike apps/pos, this sidebar repeats on every screen, so the shell also
// carries a skip link and a `<nav>`. The wordmark sits at the sidebar's top,
// where both mocks draw it; landmark count: .scratch/decisions/021.
export function AppShell() {
  return (
    <div className="scrollbar-slim flex h-dvh flex-col bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-background focus:p-2"
      >
        Skip to content
      </a>
      <Sheet>
        {/* The 390 mock's single top bar, and the only chrome row before `<main>`
            at that width — issue 07's QA round 1. Not a `<header>`: the page's one
            banner is the sidebar's, and this row does not exist at `md`. */}
        <div className="flex items-center justify-between p-4 md:hidden">
          <SheetTrigger className="tap-target" aria-label="Open navigation">
            ☰
          </SheetTrigger>
        </div>
        <SidebarProvider className="min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-visible">
          <SheetContent side="left" className="p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <Sidebar collapsible="none" className="h-full w-full">
              <SidebarBrand />
              <Nav />
            </Sidebar>
          </SheetContent>
          <Sidebar collapsible="none" className="hidden md:flex md:shrink-0 md:overflow-y-auto">
            <SidebarBrand />
            <Nav />
          </Sidebar>
          <main id="main-content" tabIndex={-1} className="flex-1 md:overflow-y-auto">
            <Outlet />
          </main>
        </SidebarProvider>
      </Sheet>
    </div>
  );
}
