import type { ReactNode } from "react";

import { cn } from "../lib/utils.ts";

// `role="status"` so a filter that empties a table announces the result —
// the rows vanishing is silent, and the table header alone reads as a list
// that is still loading.
function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center gap-3 px-6 py-12 text-center [&>svg]:size-5",
        className,
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground [&>svg]:size-5">
        {icon}
      </div>
      <div className="flex flex-col gap-1">
        <p className="font-medium text-foreground">{title}</p>
        {description && (
          <p className="max-w-sm text-sm text-balance text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export { EmptyState };
