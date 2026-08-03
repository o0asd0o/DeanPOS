import { useRef, useState } from "react";
import { Button, Sheet, SheetContent } from "ui";

import { DeviceListCard } from "./DeviceListCard.tsx";
import { EnrolmentCodeDialog } from "./EnrolmentCodeDialog.tsx";
import { GenerateCodeSheet } from "./GenerateCodeSheet.tsx";
import { PendingEnrolments } from "./PendingEnrolments.tsx";
import { PendingEnrolmentsDialog } from "./PendingEnrolmentsDialog.tsx";
import { RenameDialog } from "./RenameDialog.tsx";
import { RevokeDialog } from "./RevokeDialog.tsx";
import {
  useCancelCodeMutation,
  useDevicesQuery,
  useInvalidatePendingCodes,
  useMeQuery,
  usePendingCodesQuery,
  useStoresQuery,
} from "./__common/queries.ts";
import type { DeviceOutput, EnrolmentCode, PendingCode } from "./helpers.ts";

// The Devices screen (issue 09, record 056 Q5): the shipped list pattern —
// one always-present live region, the list Card, then the enrol sheet or a
// dialog when open. `admin`-only; a non-admin sees the list read-only.
export function Devices() {
  const devicesQuery = useDevicesQuery();
  const storesQuery = useStoresQuery();
  const pendingCodesQuery = usePendingCodesQuery();
  const invalidatePendingCodes = useInvalidatePendingCodes();
  const meQuery = useMeQuery();
  const isAdmin = meQuery.data?.authenticated === true && meQuery.data.role === "admin";

  const storeNameById = new Map((storesQuery.data ?? []).map((store) => [store.id, store.name]));
  const activeStores = (storesQuery.data ?? []).filter((store) => store.active);
  const storesLoaded = !storesQuery.isPending && !storesQuery.isError;

  const [announcement, setAnnouncement] = useState<{ text: string; slot: 0 | 1 }>({
    text: "",
    slot: 0,
  });
  const announce = (text: string) =>
    setAnnouncement((prev) => ({ text, slot: prev.slot === 0 ? 1 : 0 }));

  const [enrolOpen, setEnrolOpen] = useState(false);
  // Counts opens rather than gating on `enrolOpen`: the form must stay
  // mounted while the sheet animates out, and start fresh on the next open.
  const [enrolSession, setEnrolSession] = useState(0);
  const [enrolmentCode, setEnrolmentCode] = useState<EnrolmentCode | null>(null);
  const lastEnrolmentCode = useRef<EnrolmentCode | null>(null);
  if (enrolmentCode) lastEnrolmentCode.current = enrolmentCode;
  const shownEnrolmentCode = enrolmentCode ?? lastEnrolmentCode.current;
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
    setEnrolSession((session) => session + 1);
    setEnrolOpen(true);
  };
  const openEnrolmentCode = (code: EnrolmentCode) => {
    opener.current = document.activeElement as HTMLElement;
    setEnrolmentCode(code);
  };
  const closeEnrol = () => {
    setEnrolOpen(false);
    opener.current?.focus();
  };
  const closeEnrolmentCode = () => {
    setEnrolmentCode(null);
    opener.current?.focus();
  };

  const pendingCodes = pendingCodesQuery.data ?? [];
  const [allPendingOpen, setAllPendingOpen] = useState(false);
  const cancelCode = useCancelCodeMutation();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const removePending = async (pending: PendingCode) => {
    if (removingId) return;
    setRemovingId(pending.id);
    const removed = await cancelCode.mutateAsync({ id: pending.id }).catch(() => ({ ok: false }));
    setRemovingId(null);
    if (removed.ok) announce(`${pending.name} enrolment removed`);
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
      {isAdmin && (
        <PendingEnrolments
          codes={pendingCodes}
          storeNameById={storeNameById}
          removingId={removingId}
          onView={openEnrolmentCode}
          onRemove={(pending) => void removePending(pending)}
          onViewAll={() => setAllPendingOpen(true)}
        />
      )}
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
      {/* Held shut until the Stores are in hand: the form's Store select
          defaults to the first one, and an empty default submits a code
          bound to no Store (the same gate as the Users editor). */}
      <Sheet
        modal={false}
        open={enrolOpen && storesLoaded}
        onOpenChange={(open) => {
          if (!open) closeEnrol();
        }}
      >
        <SheetContent
          side="right"
          showCloseButton={false}
          className="detached-panel inset-y-4 right-4 h-auto rounded-2xl border-0 bg-transparent p-0 shadow-none sm:max-w-lg"
        >
          {enrolSession > 0 && storesLoaded && (
            <GenerateCodeSheet
              key={enrolSession}
              stores={activeStores}
              onClose={closeEnrol}
              onGenerated={(result) => {
                setEnrolOpen(false);
                setEnrolmentCode(result);
              }}
              onAnnounce={announce}
            />
          )}
        </SheetContent>
      </Sheet>
      <PendingEnrolmentsDialog
        codes={pendingCodes}
        storeNameById={storeNameById}
        removingId={removingId}
        open={allPendingOpen}
        onOpenChange={setAllPendingOpen}
        onView={(pending) => {
          setAllPendingOpen(false);
          openEnrolmentCode(pending);
        }}
        onRemove={(pending) => void removePending(pending)}
      />
      {shownEnrolmentCode && (
        <EnrolmentCodeDialog
          result={shownEnrolmentCode}
          storeName={storeNameById.get(shownEnrolmentCode.storeId) ?? ""}
          open={enrolmentCode !== null}
          onOpenChange={(open) => {
            if (!open) closeEnrolmentCode();
          }}
          onEnrolled={(name) => {
            closeEnrolmentCode();
            void invalidatePendingCodes();
            announce(`${name} enrolled`);
          }}
        />
      )}
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
