import { useId } from "react";
import {
  cn,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  sidebarMenuButtonVariants,
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
              <span className={cn(sidebarMenuButtonVariants())}>{item}</span>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
