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

const isStatusVariant = (
  variant: VariantProps<typeof badgeVariants>["variant"],
): variant is "success" | "warning" | "info" | "danger" =>
  variant === "success" || variant === "warning" || variant === "info" || variant === "danger";

function Badge({
  className,
  variant = "default",
  asChild = false,
  children,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span";

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), asChild && "tap-target", className)}
      {...props}
    >
      {isStatusVariant(variant) ? (
        <span
          aria-hidden="true"
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            variant === "success" && "bg-status-success-tone",
            variant === "warning" && "bg-status-warning-tone",
            variant === "info" && "bg-status-info-tone",
            variant === "danger" && "bg-status-danger-tone",
          )}
        />
      ) : null}
      <Slot.Slottable>{children}</Slot.Slottable>
    </Comp>
  );
}

export { Badge, badgeVariants };
