import {
  BookOpenIcon,
  CalendarClockIcon,
  CalendarDaysIcon,
  CreditCardIcon,
  FolderTreeIcon,
  LayoutDashboardIcon,
  MonitorSmartphoneIcon,
  PackageIcon,
  PercentIcon,
  PuzzleIcon,
  ReceiptTextIcon,
  SettingsIcon,
  ShieldAlertIcon,
  TagsIcon,
  Undo2Icon,
  UserRoundIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";
import { SidebarContent } from "ui";

import { NavGroup } from "./NavGroup.tsx";
import type { NavItem } from "./NavGroup.tsx";

const REPORTS: NavItem[] = [
  { label: "Summary", icon: LayoutDashboardIcon, to: "/reports/summary" },
  { label: "Orders", icon: ReceiptTextIcon, to: "/reports/orders" },
  { label: "By item", icon: PackageIcon, to: "/reports/by-item" },
  { label: "By category", icon: FolderTreeIcon, to: "/reports/by-category" },
  { label: "By cashier", icon: UserRoundIcon, to: "/reports/by-cashier" },
  { label: "By payment method", icon: CreditCardIcon, to: "/reports/by-payment-method" },
  { label: "Discounts & overrides", icon: PercentIcon, to: "/reports/discounts-overrides" },
  { label: "Refunds", icon: Undo2Icon, to: "/reports/refunds" },
];

const OPERATIONS: NavItem[] = [
  { label: "Drawer sessions", icon: WalletIcon, to: "/reports/drawer-sessions" },
  { label: "Catalog", icon: BookOpenIcon, to: "/catalog" },
  { label: "Add-ons", icon: PuzzleIcon, to: "/add-ons" },
  { label: "Discounts", icon: TagsIcon, to: "/discounts" },
  { label: "Availability", icon: CalendarClockIcon, to: "/availability" },
];

const ADMINISTRATION: NavItem[] = [
  { label: "Devices", icon: MonitorSmartphoneIcon, to: "/devices" },
  { label: "Users", icon: UsersIcon, to: "/users" },
  { label: "Roster", icon: CalendarDaysIcon, to: "/roster" },
  { label: "Settings", icon: SettingsIcon, to: "/settings" },
  { label: "Quarantine", icon: ShieldAlertIcon, to: "/quarantine" },
];

// Three named groups, not the mock's two — record 022. Every entry routes to a
// `Placeholder`; the screens themselves belong to later areas. Record 020.
export function Nav() {
  return (
    <nav aria-label="Primary" className="flex min-h-0 flex-1 flex-col">
      <SidebarContent>
        <NavGroup label="Reports" items={REPORTS} />
        <NavGroup label="Operations" items={OPERATIONS} />
        <NavGroup label="Administration" items={ADMINISTRATION} />
      </SidebarContent>
    </nav>
  );
}
