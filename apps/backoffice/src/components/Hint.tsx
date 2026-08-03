import type { ReactNode } from "react";

import { InfoTooltip } from "./InfoTooltip.tsx";

// Field guidance: quieter than the control it explains. A long `detail` moves
// into a tooltip so the form stays scannable, and stays in the DOM `sr-only`
// so it is never only-on-hover for anyone (record 050).
export function Hint({
  children,
  detail,
  id,
}: {
  children: ReactNode;
  detail?: string;
  id?: string;
}) {
  return (
    <p id={id} className="text-sm text-muted-foreground">
      {children}
      {detail && (
        <>
          {" "}
          <InfoTooltip>{detail}</InfoTooltip>
          <span className="sr-only"> {detail}</span>
        </>
      )}
    </p>
  );
}
