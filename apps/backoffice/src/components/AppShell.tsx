import { Outlet } from "@tanstack/react-router";
import { Sheet, SheetContent, SheetTitle, SheetTrigger, Sidebar, SidebarProvider } from "ui";

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
      <Sheet>
        <header className="flex items-center justify-between border-b border-border p-4">
          <span className="text-lg font-bold">DeanPOS</span>
          <SheetTrigger className="tap-target md:hidden" aria-label="Open navigation">
            ☰
          </SheetTrigger>
        </header>
        <SidebarProvider className="min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-visible">
          <SheetContent side="left" className="p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <Sidebar collapsible="none" className="h-full w-full">
              <Nav />
            </Sidebar>
          </SheetContent>
          <Sidebar
            collapsible="none"
            className="hidden md:flex md:shrink-0 md:overflow-y-auto md:border-r md:border-border"
          >
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
