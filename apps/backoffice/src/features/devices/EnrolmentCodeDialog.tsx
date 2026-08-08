import { Fragment, useEffect, useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "ui";

import { useEnrolmentWatchQuery } from "./__common/queries.ts";
import { useLastNonNull } from "./helpers.ts";
import type { EnrolmentCode } from "./helpers.ts";

// The result half of record 056 Q5's enrolment panel, as a modal dialog: the
// code is the only thing to read and nothing else on the screen is actionable
// while a terminal is being enrolled. Expiry is still computed once, never ticks.
export function EnrolmentCodeDialog({
  result,
  storeName,
  open,
  onOpenChange,
  onEnrolled,
}: {
  result: EnrolmentCode | null;
  storeName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEnrolled: (name: string) => void;
}) {
  // The parent nulls `result` on close, but this dialog stays mounted for the
  // exit animation — keep showing the last code rather than a blank box.
  const shownResult = useLastNonNull(result);
  // The code is reserved at its Store until it is redeemed, so a Device
  // carrying it is proof this enrolment landed. The poll is scoped to the
  // code, so the enrolled Device is on page 1 of the list no matter how it
  // sorts in the fleet.
  const watch = useEnrolmentWatchQuery(open, shownResult?.code);
  const enrolled = (watch.data?.items ?? []).some(
    (device) => device.storeId === shownResult?.storeId && device.code === shownResult?.code,
  );

  useEffect(() => {
    if (open && enrolled && shownResult) onEnrolled(shownResult.name);
  }, [open, enrolled, onEnrolled, shownResult]);

  const characters = shownResult?.secret.split("") ?? [];
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    // Clipboard access can be refused outright (permissions, insecure origin);
    // the code is still readable on screen, so a failure needs no alarm.
    try {
      await navigator.clipboard?.writeText(shownResult?.secret ?? "");
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  if (!shownResult) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enrolment code</DialogTitle>
          <DialogDescription>
            {shownResult.name} · {storeName}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3 rounded-xl border bg-muted p-4">
          <p className="sr-only">{characters.join(" ")}</p>
          {/* Tiles share the row rather than claim a fixed width, so a longer
              secret narrows them instead of overflowing the dialog. */}
          <div aria-hidden className="flex w-full items-center gap-1">
            {characters.map((character, index) => (
              <Fragment key={index}>
                {index === 4 && <span className="w-2 shrink-0" />}
                <span className="grid aspect-square min-w-0 flex-1 place-items-center rounded-lg border bg-card text-xl font-semibold">
                  {character}
                </span>
              </Fragment>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Single-use. Enter it on the terminal.</p>
        </div>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="relative flex size-2 shrink-0">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-status-info-tone opacity-60" />
            <span className="inline-flex size-2 rounded-full bg-status-info-tone" />
          </span>
          Waiting for the terminal — this closes itself once it enrols.
        </p>
        <p className="text-sm text-muted-foreground">
          Expires in 10 minutes, at{" "}
          <time dateTime={shownResult.expiresAt.toISOString()}>
            {shownResult.expiresAt.toLocaleTimeString()}
          </time>
          .
        </p>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => void copy()} className="mr-auto">
            {copied ? <CheckIcon /> : <CopyIcon />}
            {copied ? "Copied" : "Copy code"}
          </Button>
          <Button type="button" onClick={() => onOpenChange(false)}>
            <CheckIcon />
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
