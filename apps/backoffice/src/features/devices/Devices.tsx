import { useRef, useState } from "react";
import { Button, Sheet, SheetContent } from "ui";

import { DeviceListCard } from "./DeviceListCard.tsx";
import { EditDeviceSheet } from "./EditDeviceSheet.tsx";
import { EnrolmentCodeDialog } from "./EnrolmentCodeDialog.tsx";
import { GenerateCodeSheet } from "./GenerateCodeSheet.tsx";
import { PendingEnrolments } from "./PendingEnrolments.tsx";
import { PendingEnrolmentsDialog } from "./PendingEnrolmentsDialog.tsx";
import { RevokeDialog } from "./RevokeDialog.tsx";
import {
  useCancelCodeMutation,
  useDevicesQuery,
  useInvalidatePendingCodes,
  useMeQuery,
  usePendingCodesQuery,
  useStoresQuery,
  useUsersQuery,
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
  const isAdmin =
    meQuery.data?.authenticated === true && meQuery.data.role === "admin";
  const usersQuery = useUsersQuery(isAdmin);

  const storeNameById = new Map(
    (storesQuery.data ?? []).map((store) => [store.id, store.name]),
  );
  const activeStores = (storesQuery.data ?? []).filter((store) => store.active);
  const storesLoaded = !storesQuery.isPending && !storesQuery.isError;
  // Who each Device is assigned to, for the editable Assigned to column — the
  // same list the dialog offers, so a name never 404s on screen.
  const userNameById = new Map(
    (usersQuery.data ?? []).map((user) => [
      user.id,
      `${user.firstName} ${user.lastName}`.trim(),
    ]),
  );

  // Fleet summary once the list is in hand; the instructional line stays
  // while loading (or after an error, when the list never arrived).
  const devicesLoaded = !devicesQuery.isPending && !devicesQuery.isError;
  const devices = devicesQuery.data ?? [];
  const subtitle =
    devicesLoaded && devices.length > 0
      ? `${devices.length} device${devices.length === 1 ? "" : "s"} · ${
          devices.filter((device) => !device.revokedAt).length
        } active`
      : "Every terminal enrolled to take sales, and when it was last seen.";

  const [announcement, setAnnouncement] = useState<{
    text: string;
    slot: 0 | 1;
  }>({
    text: "",
    slot: 0,
  });
  const announce = (text: string) =>
    setAnnouncement((prev) => ({ text, slot: prev.slot === 0 ? 1 : 0 }));

  const [enrolOpen, setEnrolOpen] = useState(false);
  const [enrolmentCode, setEnrolmentCode] = useState<EnrolmentCode | null>(
    null,
  );
  const [revokeTarget, setRevokeTarget] = useState<DeviceOutput | null>(null);
  const [editTarget, setEditTarget] = useState<DeviceOutput | null>(null);
  // Radix restores focus only to a Trigger; these sheets open from a plain
  // Button, so the opener is remembered here for the close handlers.
  const opener = useRef<HTMLElement | null>(null);

  const openEnrol = () => {
    opener.current = document.activeElement as HTMLElement;
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

  const openEdit = (device: DeviceOutput) => {
    opener.current = document.activeElement as HTMLElement;
    setEditTarget(device);
  };
  const closeEdit = () => {
    setEditTarget(null);
    opener.current?.focus();
  };

  const pendingCodes = pendingCodesQuery.data ?? [];
  const [allPendingOpen, setAllPendingOpen] = useState(false);
  const cancelCode = useCancelCodeMutation();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const removePending = async (pending: PendingCode) => {
    if (removingId) return;
    setRemovingId(pending.id);
    const removed = await cancelCode
      .mutateAsync({ id: pending.id })
      .catch(() => ({ ok: false }));
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
          <p className="text-sm text-muted-foreground">{subtitle}</p>
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
        userNameById={userNameById}
        isPending={devicesQuery.isPending}
        isError={devicesQuery.isError}
        isFetching={devicesQuery.isFetching}
        refetch={() => devicesQuery.refetch()}
        isAdmin={isAdmin}
        onEdit={openEdit}
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
          {storesLoaded && (
            <GenerateCodeSheet
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
      <Sheet
        modal={false}
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) closeEdit();
        }}
      >
        <SheetContent
          side="right"
          showCloseButton={false}
          className="detached-panel inset-y-4 right-4 h-auto rounded-2xl border-0 bg-transparent p-0 shadow-none sm:max-w-lg"
        >
          <EditDeviceSheet
            device={editTarget}
            users={usersQuery.data ?? []}
            onClose={closeEdit}
            onSaved={() => {
              closeEdit();
              announce("Device updated");
            }}
          />
        </SheetContent>
      </Sheet>
      <EnrolmentCodeDialog
        result={enrolmentCode}
        storeName={storeNameById.get(enrolmentCode?.storeId ?? "") ?? ""}
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
      <RevokeDialog
        device={revokeTarget}
        open={revokeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null);
        }}
        onRevoked={(name) => {
          setRevokeTarget(null);
          announce(`${name} revoked`);
        }}
      />
    </div>
  );
}
