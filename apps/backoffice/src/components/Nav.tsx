import {
  cn,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  sidebarMenuButtonVariants,
} from "ui";

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

// Sidebar structure and order only — reports-summary-1440.svg. No screen exists
// behind any entry yet, so each row is a `<span>` carrying the pulled sidebar's
// pill styling (`sidebarMenuButtonVariants`), not a button and not a link —
// `SidebarMenuButton` itself needs `useSidebar()`, which needs a state provider
// this nav has no use for. The active pill is a style nothing wires yet.
//
// No `id`/`aria-labelledby` pairing on the group label: this `Nav` renders
// twice at once (the always-mounted desktop `<aside>` plus the mobile
// `Sheet`), and a shared id would duplicate the moment the sheet opens.
export function Nav() {
  return (
    <nav aria-label="Primary">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Reports</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {REPORTS.map((label) => (
                <SidebarMenuItem key={label}>
                  <span className={cn(sidebarMenuButtonVariants())}>{label}</span>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {CONFIGURATION.map((label) => (
                <SidebarMenuItem key={label}>
                  <span className={cn(sidebarMenuButtonVariants())}>{label}</span>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </nav>
  );
}
