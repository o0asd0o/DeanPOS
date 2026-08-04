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
  ShieldAlertIcon,
  StoreIcon,
  TagsIcon,
  Undo2Icon,
  UserRoundIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";

import type { NavItem } from "./NavGroup.tsx";

// The sidebar's three groups (record 022), here rather than in `Nav` because
// the header's search reaches the same screens by name. `minRole` mirrors
// each route's own `staticData.minRole` exactly — held equal by
// `tests/nav-groups-match-routes.test.ts` (issue 15, record 063 §5).
export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Reports",
    items: [
      { label: "Summary", icon: LayoutDashboardIcon, to: "/reports/summary", minRole: "admin" },
      { label: "Orders", icon: ReceiptTextIcon, to: "/reports/orders", minRole: "admin" },
      { label: "By item", icon: PackageIcon, to: "/reports/by-item", minRole: "admin" },
      {
        label: "By category",
        icon: FolderTreeIcon,
        to: "/reports/by-category",
        minRole: "admin",
      },
      { label: "By cashier", icon: UserRoundIcon, to: "/reports/by-cashier", minRole: "admin" },
      {
        label: "By payment method",
        icon: CreditCardIcon,
        to: "/reports/by-payment-method",
        minRole: "admin",
      },
      {
        label: "Discounts & overrides",
        icon: PercentIcon,
        to: "/reports/discounts-overrides",
        minRole: "manager",
      },
      { label: "Refunds", icon: Undo2Icon, to: "/reports/refunds", minRole: "admin" },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        label: "Drawer sessions",
        icon: WalletIcon,
        to: "/reports/drawer-sessions",
        minRole: "admin",
      },
      { label: "Catalog", icon: BookOpenIcon, to: "/catalog", minRole: "admin" },
      { label: "Add-ons", icon: PuzzleIcon, to: "/add-ons", minRole: "admin" },
      { label: "Discounts", icon: TagsIcon, to: "/discounts", minRole: "admin" },
      { label: "Availability", icon: CalendarClockIcon, to: "/availability", minRole: "admin" },
    ],
  },
  {
    label: "Administration",
    items: [
      { label: "Stores", icon: StoreIcon, to: "/stores", minRole: "manager" },
      {
        label: "Payment methods",
        icon: CreditCardIcon,
        to: "/payment-methods",
        minRole: "admin",
      },
      { label: "Devices", icon: MonitorSmartphoneIcon, to: "/devices", minRole: "admin" },
      { label: "Employees", icon: UsersIcon, to: "/employees", minRole: "manager" },
      { label: "Roster", icon: CalendarDaysIcon, to: "/roster", minRole: "admin" },
      { label: "Quarantine", icon: ShieldAlertIcon, to: "/quarantine", minRole: "admin" },
    ],
  },
];

// A User's own name, now that `auth.me` carries one (issue 15, record 063
// Amendment 1) — no longer derived from the email local-part.
export const displayName = (firstName: string | undefined, lastName: string | undefined): string =>
  [firstName, lastName].filter(Boolean).join(" ") || "Account";

export const initials = (firstName: string | undefined, lastName: string | undefined): string =>
  [firstName, lastName]
    .filter(Boolean)
    .map((part) => part![0]!.toUpperCase())
    .join("") || "—";
