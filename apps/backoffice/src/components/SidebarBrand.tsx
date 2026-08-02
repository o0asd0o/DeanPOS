import { SidebarHeader } from "ui";

// The page's one `<header>`. Both back-office mocks draw the wordmark at the
// sidebar's top, not in a full-width bar across the content — record 021.
export function SidebarBrand() {
  return (
    <SidebarHeader>
      <header className="px-2 py-1">
        <span className="text-lg font-bold">DeanPOS</span>
      </header>
    </SidebarHeader>
  );
}
