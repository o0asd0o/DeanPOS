import { SidebarContent } from "ui";

import { NavGroup } from "./NavGroup.tsx";

const REPORTS = [
  "Summary",
  "Orders",
  "By item",
  "By category",
  "By cashier",
  "By payment method",
  "Discounts & overrides",
  "Refunds",
  "Drawer sessions",
];

const CONFIGURATION = [
  "Catalog",
  "Add-ons",
  "Discounts",
  "Availability",
  "Devices",
  "Users",
  "Roster",
  "Settings",
  "Quarantine",
];

// Structure and order only — reports-summary-1440.svg. No screen exists behind
// any entry yet, so `NavGroup` renders each row as inert text, not a link.
export function Nav() {
  return (
    <nav aria-label="Primary" className="flex min-h-0 flex-1 flex-col">
      <SidebarContent>
        <NavGroup label="Reports" items={REPORTS} />
        <NavGroup items={CONFIGURATION} />
      </SidebarContent>
    </nav>
  );
}
