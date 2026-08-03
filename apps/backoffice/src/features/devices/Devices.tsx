import { useRef, useState } from "react";
import { Button, Sheet, SheetContent } from "ui";

import { DeviceListCard } from "./DeviceListCard.tsx";
import { GenerateCodeSheet } from "./GenerateCodeSheet.tsx";
import { RenameDialog } from "./RenameDialog.tsx";
import { RevokeDialog } from "./RevokeDialog.tsx";
import { useDevicesQuery, useMeQuery, useStoresQuery } from "./__common/queries.ts";
import type { DeviceOutput } from "./helpers.ts";

// The Devices screen (issue 09, record 056 Q5): the shipped list pattern —
// one always-present live region, the list Card, then the enrol sheet or a
// dialog when open. `admin`-only; a non-admin sees the list read-only.
export function Devices() {
  const devicesQuery = useDevicesQuery();
  const storesQuery = useStoresQuery();
  const meQuery = useMeQuery();
  const isAdmin = meQuery.data?.authenticated === true && meQuery.data.role === "admin";

  const storeNameById = new Map((storesQuery.data ?? []).map((store) => [store.id, store.name]));
  const activeStores = (storesQuery.data ?? []).filter((store) => store.active);

  const [announcement, setAnnouncement] = useState<{ text: string; slot: 0 | 1 }>({
    text: "",
    slot: 0,
  });
  const announce = (text: string) =>
    setAnnouncement((prev) => ({ text, slot: prev.slot === 0 ? 1 : 0 }));

  const [enrolOpen, setEnrolOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<DeviceOutput | null>(null);
  const lastRenameTarget = useRef<DeviceOutput | null>(null);
  if (renameTarget) lastRenameTarget.current = renameTarget;
  const shownRenameTarget = renameTarget ?? lastRenameTarget.current;
  const [revokeTarget, setRevokeTarget] = useState<DeviceOutput | null>(null);
  const lastRevokeTarget = useRef<DeviceOutput | null>(null);
  if (revokeTarget) lastRevokeTarget.current = revokeTarget;
  const shownRevokeTarget = revokeTarget ?? lastRevokeTarget.current;
  const opener = useRef<HTMLElement | null>(null);

  const openEnrol = () => {
    opener.current = document.activeElement as HTMLElement;
    setEnrolOpen(true);
  };
  const closeEnrol = () => {
    setEnrolOpen(false);
    opener.current?.focus();
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <p role="status" className="sr-only">
        {announcement.slot === 0 ? announcement.text : ""}
      </p>
      <p role="status" className="sr-only">
        {announcement.slot === 1 ? announcement.text : ""}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Devices</h1>
          <p className="text-sm text-muted-foreground">
            Every terminal enrolled to take sales, and when it was last seen.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={openEnrol} className="tap-target">
            Enrol a device
          </Button>
        )}
      </div>
      <DeviceListCard
        devices={devicesQuery.data}
        storeNameById={storeNameById}
        isPending={devicesQuery.isPending}
        isError={devicesQuery.isError}
        isFetching={devicesQuery.isFetching}
        refetch={() => devicesQuery.refetch()}
        isAdmin={isAdmin}
        onRename={(device) => {
          opener.current = document.activeElement as HTMLElement;
          setRenameTarget(device);
        }}
        onRevoke={(device) => {
          opener.current = document.activeElement as HTMLElement;
          setRevokeTarget(device);
        }}
      />
      <Sheet
        modal={false}
        open={enrolOpen}
        onOpenChange={(open) => {
          if (!open) closeEnrol();
        }}
      >
        <SheetContent
          side="right"
          showCloseButton={false}
          className="detached-panel inset-y-4 right-4 h-auto rounded-2xl border-0 bg-transparent p-0 shadow-none sm:max-w-lg"
        >
          {enrolOpen && (
            <GenerateCodeSheet stores={activeStores} onClose={closeEnrol} onAnnounce={announce} />
          )}
        </SheetContent>
      </Sheet>
      {shownRenameTarget && (
        <RenameDialog
          device={shownRenameTarget}
          open={renameTarget !== null}
          onOpenChange={(open) => {
            if (!open) setRenameTarget(null);
          }}
          onRenamed={(name) => {
            setRenameTarget(null);
            announce(`Renamed to ${name}`);
          }}
        />
      )}
      {shownRevokeTarget && (
        <RevokeDialog
          device={shownRevokeTarget}
          open={revokeTarget !== null}
          onOpenChange={(open) => {
            if (!open) setRevokeTarget(null);
          }}
          onRevoked={(name) => {
            setRevokeTarget(null);
            announce(`${name} revoked`);
          }}
        />
      )}
    </div>
  );
}
