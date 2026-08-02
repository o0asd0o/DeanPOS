import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "../lib/utils.ts";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,box-shadow] aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary: "bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive: "bg-destructive text-destructive-foreground [a&]:hover:bg-destructive/90",
        outline:
          "border-border text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        ghost: "[a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        link: "text-primary underline-offset-4 [a&]:hover:underline",
        success: "bg-status-success-tint text-foreground",
        warning: "bg-status-warning-tint text-foreground",
        info: "bg-status-info-tint text-foreground",
        danger: "bg-status-danger-tint text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

// ADR-0013 bars a saturated accent from carrying a label, so a status badge is
// a pale `-tint` fill with the saturated `-tone` reserved for this dot.
const statusDotVariant: Record<string, string> = {
  success: "bg-status-success-tone",
  warning: "bg-status-warning-tone",
  info: "bg-status-info-tone",
  danger: "bg-status-danger-tone",
};

function Badge({
  className,
  variant = "default",
  asChild = false,
  children,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span";
  const dotClassName = variant ? statusDotVariant[variant] : undefined;

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    >
      {dotClassName ? (
        <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", dotClassName)} />
      ) : null}
      {children}
    </Comp>
  );
}

export { Badge, badgeVariants };
