import { InfoIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "ui";

// The tooltip half of a hint. Its text is also rendered `sr-only` by the
// caller — a tooltip alone is hover-only, and invisible to anyone who does not
// hover (record 050).
export function InfoTooltip({ children }: { children: string }) {
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="tap-target align-middle" aria-label="More">
            <InfoIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-72">{children}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
