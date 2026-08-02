import { Link, useMatchRoute } from "@tanstack/react-router";
import type { LinkProps } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { useId } from "react";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "ui";

export type NavItem = { label: string; icon: LucideIcon; to: LinkProps["to"] };

// One entry of Nav's structure: an optional heading, then links styled by the
// pulled sidebar's pill classes. `useId` keeps the heading/list pairing intact
// without a fixed id colliding when `Nav` mounts twice (desktop + Sheet).
export function NavGroup({
  label,
  items,
  onNavigate,
}: {
  label?: string;
  items: NavItem[];
  onNavigate?: () => void;
}) {
  const headingId = useId();
  const matchRoute = useMatchRoute();

  return (
    <SidebarGroup>
      {label && (
        <SidebarGroupLabel asChild>
          <h2 id={headingId}>{label}</h2>
        </SidebarGroupLabel>
      )}
      <SidebarGroupContent>
        <SidebarMenu aria-labelledby={label ? headingId : undefined}>
          {items.map(({ label: item, icon: Icon, to }) => (
            <SidebarMenuItem key={item}>
              <SidebarMenuButton asChild isActive={Boolean(matchRoute({ to }))}>
                <Link to={to} onClick={onNavigate}>
                  <Icon aria-hidden="true" />
                  <span>{item}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
