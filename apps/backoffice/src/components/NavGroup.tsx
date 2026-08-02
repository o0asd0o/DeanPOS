import { useId } from "react";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "ui";

// One entry of Nav's structure: an optional heading, then inert rows styled
// by the pulled sidebar's pill classes. `useId` keeps the heading/list pairing
// intact without a fixed id colliding when `Nav` mounts twice (desktop + Sheet).
export function NavGroup({ label, items }: { label?: string; items: string[] }) {
  const headingId = useId();

  return (
    <SidebarGroup>
      {label && (
        <SidebarGroupLabel asChild>
          <h2 id={headingId}>{label}</h2>
        </SidebarGroupLabel>
      )}
      <SidebarGroupContent>
        <SidebarMenu aria-labelledby={label ? headingId : undefined}>
          {items.map((item) => (
            <SidebarMenuItem key={item}>
              <SidebarMenuButton asChild className="pointer-events-none">
                <span>{item}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
