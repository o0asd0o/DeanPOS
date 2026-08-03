import { Button } from "ui";

import type { PendingCode } from "./helpers.ts";

// One enrolment still waiting for its terminal. Removing it expires the code
// on the spot, which also frees its short code for another Device.
export function PendingEnrolmentNotice({
  pending,
  storeName,
  removing,
  onView,
  onRemove,
}: {
  pending: PendingCode;
  storeName: string;
  removing: boolean;
  onView: (pending: PendingCode) => void;
  onRemove: (pending: PendingCode) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-status-info-tint px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="relative flex size-2 shrink-0">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-status-info-tone opacity-60" />
          <span className="inline-flex size-2 rounded-full bg-status-info-tone" />
        </span>
        <p className="text-sm">
          <span className="font-medium">
            {pending.name} · {storeName}
          </span>{" "}
          <span className="text-muted-foreground">waiting for a terminal</span>
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => onView(pending)}>
          View code
        </Button>
        <Button
          type="button"
          variant="outline"
          danger
          size="sm"
          aria-disabled={removing}
          onClick={() => onRemove(pending)}
        >
          {removing ? "Removing…" : "Remove"}
        </Button>
      </div>
    </div>
  );
}
