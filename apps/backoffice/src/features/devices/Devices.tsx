import { useNavigate, useSearch } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Button, Sheet, SheetContent } from "ui";

import type { HealthFilter } from "@/components/ListToolbar.tsx";
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
  useInvalidateDevices,
  useInvalidatePendingCodes,
  useMeQuery,
  usePendingCodesQuery,
  useStoresQuery,
  useUsersQuery,
} from "./__common/queries.ts";
import {
  DEVICES_PAGE_SIZE,
  type DeviceListSort,
  type DeviceListSortKey,
  type DeviceOutput,
  type EnrolmentCode,
  type PendingCode,
} from "./helpers.ts";

// The Devices screen (issue 09, record 056 Q5): the shipped list pattern —
// one always-present live region, the list Card, then the enrol sheet or a
// dialog when open. `admin`-only; a non-admin sees the list read-only.
export function Devices() {
  // The toolbar's filters, the sort, and the page are URL state (the route's
  // validateSearch): a filtered view survives a trip to a row's Edit sheet,
  // and the list query is a server page of that state.
  const { health, store, q, sort, page } = useSearch({
    from: "/_shell/devices",
  });
  // `to` is the path — a search-only navigate from a `from` route id resolves
  // against the id as if it were a path and lands on NotFound. The full
  // object (not a spread of `prev`) is what the route's search type wants.
  const navigate = useNavigate();
  const search = {
    health,
    store,
    q,
    sort,
    page,
  };
  // Any filter or sort change starts back at page 1 — a stale page number in
  // the URL would otherwise land on a page that no longer exists.
  const setHealth = (health: HealthFilter) =>
    navigate({
      to: "/devices",
      search: { ...search, health, page: 1 },
      replace: true,
    });
  const setStore = (store: string) =>
    navigate({
      to: "/devices",
      search: { ...search, store, page: 1 },
      replace: true,
    });
  const setQuery = (q: string) =>
    navigate({
      to: "/devices",
      search: { ...search, q, page: 1 },
      replace: true,
    });

  const setSort = (key: DeviceListSortKey) => {
    const next: DeviceListSort =
      sort.key === key
        ? { key, direction: sort.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" };
    void navigate({
      to: "/devices",
      search: { ...search, sort: next, page: 1 },
      replace: true,
    });
  };
  const setPage = (page: number) =>
    navigate({ to: "/devices", search: { ...search, page }, replace: true });

  const devicesQuery = useDevicesQuery({
    page,
    perPage: DEVICES_PAGE_SIZE,
    health,
    storeId: store === "all" ? undefined : store,
    search: q || undefined,
    sort,
  });
  const storesQuery = useStoresQuery();
  const pendingCodesQuery = usePendingCodesQuery();
  const invalidatePendingCodes = useInvalidatePendingCodes();
  const invalidateDevices = useInvalidateDevices();
  const meQuery = useMeQuery();
  const isAdmin = meQuery.data?.authenticated === true && meQuery.data.role === "admin";
  const usersQuery = useUsersQuery(isAdmin);

  const storeNameById = new Map((storesQuery.data ?? []).map((store) => [store.id, store.name]));
  const activeStores = (storesQuery.data ?? []).filter((store) => store.active);
  const storesLoaded = !storesQuery.isPending && !storesQuery.isError;
  // Who each Device is assigned to, for the editable Assigned to column — the
  // same list the dialog offers, so a name never 404s on screen.
  const userNameById = new Map(
    (usersQuery.data ?? []).map((user) => [user.id, `${user.firstName} ${user.lastName}`.trim()]),
  );

  // Fleet summary once the list is in hand; the instructional line stays
  // while loading (or after an error, when the list never arrived). The
  // headline counts the whole fleet, not the page (record 056 Q5).
  const devicesLoaded = !devicesQuery.isPending && !devicesQuery.isError;
  const totalCount = devicesQuery.data?.totalCount ?? 0;
  const activeCount = devicesQuery.data?.activeCount ?? 0;
  const subtitle =
    devicesLoaded && totalCount > 0
      ? `${totalCount} device${totalCount === 1 ? "" : "s"} · ${activeCount} active`
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
  const [enrolmentCode, setEnrolmentCode] = useState<EnrolmentCode | null>(null);
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
        data={devicesQuery.data}
        storeNameById={storeNameById}
        userNameById={userNameById}
        isPending={devicesQuery.isPending}
        isError={devicesQuery.isError}
        isFetching={devicesQuery.isFetching}
        refetch={() => devicesQuery.refetch()}
        isAdmin={isAdmin}
        health={health}
        onHealthChange={setHealth}
        store={store}
        onStoreChange={setStore}
        query={q}
        onQueryChange={setQuery}
        sort={sort}
        onSortChange={setSort}
        onPageChange={setPage}
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
          // The enrolled Device is a new row — refresh the fleet so the
          // table shows it without waiting for the next 60s poll.
          invalidateDevices();
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
