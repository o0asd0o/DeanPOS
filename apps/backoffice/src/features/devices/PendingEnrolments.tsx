import { Button } from "ui";

import type { PendingCode } from "./helpers.ts";
import { PendingEnrolmentNotice } from "./PendingEnrolmentNotice.tsx";

const VISIBLE_LIMIT = 3;

// Three notices at most on the screen itself; the rest live behind the
// dialog, so a burst of enrolments cannot push the Device list off-screen.
export function PendingEnrolments({
  codes,
  storeNameById,
  removingId,
  onView,
  onRemove,
  onViewAll,
}: {
  codes: PendingCode[];
  storeNameById: Map<string, string>;
  removingId: string | null;
  onView: (pending: PendingCode) => void;
  onRemove: (pending: PendingCode) => void;
  onViewAll: () => void;
}) {
  if (codes.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {codes.slice(0, VISIBLE_LIMIT).map((pending) => (
        <PendingEnrolmentNotice
          key={pending.id}
          pending={pending}
          storeName={storeNameById.get(pending.storeId) ?? ""}
          removing={removingId === pending.id}
          onView={onView}
          onRemove={onRemove}
        />
      ))}
      {codes.length > VISIBLE_LIMIT && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start underline"
          onClick={onViewAll}
        >
          View all {codes.length} enrolments
        </Button>
      )}
    </div>
  );
}
