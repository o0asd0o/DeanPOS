import { InfoIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "ui";

// Field guidance: quieter than the control it explains. A long `detail` moves
// into a tooltip so the form stays scannable, and stays in the DOM `sr-only`
// so it is never only-on-hover for anyone (record 050).
export function Hint({
  children,
  detail,
  id,
}: {
  children: React.ReactNode;
  detail?: string;
  id?: string;
}) {
  return (
    <p id={id} className="text-sm text-muted-foreground">
      {children}
      {detail && (
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="tap-target ml-1 align-middle" aria-label="More">
                <InfoIcon className="size-4" aria-hidden="true" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-72">{detail}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      {detail && <span className="sr-only"> {detail}</span>}
    </p>
  );
}
