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
  StoreIcon,
  TagsIcon,
  Undo2Icon,
  UserRoundIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";

import type { NavItem } from "./NavGroup.tsx";

// The sidebar's three groups (record 022), here rather than in `Nav` because
// the header's search reaches the same screens by name.
export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Reports",
    items: [
      { label: "Summary", icon: LayoutDashboardIcon, to: "/reports/summary" },
      { label: "Orders", icon: ReceiptTextIcon, to: "/reports/orders" },
      { label: "By item", icon: PackageIcon, to: "/reports/by-item" },
      { label: "By category", icon: FolderTreeIcon, to: "/reports/by-category" },
      { label: "By cashier", icon: UserRoundIcon, to: "/reports/by-cashier" },
      { label: "By payment method", icon: CreditCardIcon, to: "/reports/by-payment-method" },
      { label: "Discounts & overrides", icon: PercentIcon, to: "/reports/discounts-overrides" },
      { label: "Refunds", icon: Undo2Icon, to: "/reports/refunds" },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Drawer sessions", icon: WalletIcon, to: "/reports/drawer-sessions" },
      { label: "Catalog", icon: BookOpenIcon, to: "/catalog" },
      { label: "Add-ons", icon: PuzzleIcon, to: "/add-ons" },
      { label: "Discounts", icon: TagsIcon, to: "/discounts" },
      { label: "Availability", icon: CalendarClockIcon, to: "/availability" },
    ],
  },
  {
    label: "Administration",
    items: [
      { label: "Stores", icon: StoreIcon, to: "/stores" },
      { label: "Devices", icon: MonitorSmartphoneIcon, to: "/devices" },
      { label: "Employees", icon: UsersIcon, to: "/employees" },
      { label: "Roster", icon: CalendarDaysIcon, to: "/roster" },
      { label: "Settings", icon: SettingsIcon, to: "/settings" },
      { label: "Quarantine", icon: ShieldAlertIcon, to: "/quarantine" },
    ],
  },
];

// A User has an email and no name column, so the header's name line is derived
// until one exists — record 048.
const localPart = (email: string) => email.split("@")[0] ?? email;

export const displayNameFromEmail = (email: string | undefined): string =>
  email
    ? localPart(email)
        .split(/[._+-]+/)
        .filter(Boolean)
        .map((part) => part[0]!.toUpperCase() + part.slice(1))
        .join(" ")
    : "Account";

// ponytail: the greeting's name is derived like the rest — read `me.firstName`
// here instead once `auth.me` carries one.
export const firstNameFromEmail = (email: string | undefined): string =>
  email ? (displayNameFromEmail(email).split(" ")[0] ?? "there") : "there";

export const initialsFromEmail = (email: string | undefined): string =>
  email
    ? displayNameFromEmail(email)
        .split(" ")
        .slice(0, 2)
        .map((part) => part[0]!.toUpperCase())
        .join("")
    : "—";
