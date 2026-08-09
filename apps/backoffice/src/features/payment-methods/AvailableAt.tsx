import { Badge, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "ui";

import { availableStores } from "./helpers.ts";
import type { PaymentMethodOutput, Store } from "./helpers.ts";

// Two names, then a `+N` — a method offered at eight stores would otherwise
// wrap its row to three lines and bury the two columns beside it.
const VISIBLE = 2;

// The `Available at` column (record 054 Q2): `All stores`, the Store names, or
// the warning a method active at no Store earns.
export function AvailableAt({ method, stores }: { method: PaymentMethodOutput; stores: Store[] }) {
  const available = availableStores(method, stores);
  if (available.length === 0)
    return method.active ? <Badge variant="warning">No stores</Badge> : <span>None</span>;
  if (available.length === stores.length) return <span>All stores</span>;

  const names = available.map((store) => store.name);
  const hidden = names.slice(VISIBLE);

  return (
    <div className="flex items-center gap-1.5">
      <span>{names.slice(0, VISIBLE).join(", ")}</span>
      {hidden.length > 0 && (
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              {/* The names are on the trigger, not only in the tooltip, which
                  is hover-only and invisible to anyone who does not hover
                  (record 050). */}
              <Badge variant="outline" asChild>
                <button type="button" aria-label={`Also at ${hidden.join(", ")}`}>
                  +{hidden.length}
                </button>
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-72">{hidden.join(", ")}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
