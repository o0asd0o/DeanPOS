import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";

import type { HealthFilter } from "@/components/ListToolbar.tsx";
import type { DeviceListSort } from "@/features/devices/helpers.ts";
import { DEVICES_PAGE_SIZE } from "@/features/devices/helpers.ts";

// The list's server-side input (mirrors deviceListInputSchema): filters,
// sort, and page ride the request, so the URL is the source of truth and a
// refetch is a new page, not a client-side re-filter.
export type DevicesQueryInput = {
  page: number;
  perPage: number;
  health: HealthFilter;
  storeId?: string;
  search?: string;
  sort: DeviceListSort;
};

export function useDevicesQuery(input: DevicesQueryInput) {
  const { orpc } = useRouteContext({ from: "/_shell/devices" });
  return useQuery({
    ...orpc.device.list.queryOptions({ input }),
    refetchInterval: 60_000,
    // Keep the previous page on screen while the next filter round-trips —
    // per-keystroke search must not flash a blank table.
    placeholderData: keepPreviousData,
  });
}

export function useStoresQuery() {
  const { orpc } = useRouteContext({ from: "/_shell/devices" });
  return useQuery(orpc.store.list.queryOptions());
}

export function useMeQuery() {
  const { orpc } = useRouteContext({ from: "/_shell/devices" });
  return useQuery(orpc.auth.me.queryOptions());
}

// The assignment dialog's picker (issue 17), `admin`-only like the dialog
// itself — a `manager` viewing this screen can't reach it. `user.list` is now
// paginated (record 076), and the picker needs the whole roster to name an
// assignee, so it asks for one page that covers it — the roster is small and
// 1000 is the contract's ceiling for exactly this read.
export function useUsersQuery(enabled: boolean) {
  const { orpc } = useRouteContext({ from: "/_shell/devices" });
  return useQuery({
    ...orpc.user.list.queryOptions({ input: { perPage: 1000 } }),
    enabled,
  });
}

// The enrolment dialog's watch. It scopes the poll to the pending code, so a
// page-1 query finds the enrolled Device no matter how deep in the fleet it
// sorts — the code is reserved until redeemed (record 056 Q5).
export function useEnrolmentWatchQuery(enabled: boolean, code: string | undefined) {
  const { orpc } = useRouteContext({ from: "/_shell/devices" });
  return useQuery({
    ...orpc.device.list.queryOptions({
      input: {
        page: 1,
        perPage: DEVICES_PAGE_SIZE,
        ...(code ? { search: code } : {}),
      },
    }),
    enabled,
    refetchInterval: 3000,
  });
}

// Codes still waiting for a terminal — the enrolment in flight survives
// closing the dialog, so it can be reopened from the list screen.
export function usePendingCodesQuery() {
  const { orpc } = useRouteContext({ from: "/_shell/devices" });
  return useQuery(orpc.device.pendingCodes.queryOptions());
}

export function useInvalidatePendingCodes() {
  const { orpc } = useRouteContext({ from: "/_shell/devices" });
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({
      queryKey: orpc.device.pendingCodes.queryKey(),
    });
}

export function useInvalidateDevices() {
  const { orpc } = useRouteContext({ from: "/_shell/devices" });
  const queryClient = useQueryClient();
  // `device.list` keys are [path, { input, type }] — a mutation must refresh
  // whichever page/filter is on screen, so match every list query by its
  // shared path segment rather than one concrete input.
  const path = orpc.device.list.queryKey({ input: {} })[0];
  return () => void queryClient.invalidateQueries({ queryKey: [path] });
}

export function useGenerateCodeMutation() {
  const { orpc } = useRouteContext({ from: "/_shell/devices" });
  const invalidate = useInvalidatePendingCodes();
  return useMutation(
    orpc.device.generateCode.mutationOptions({
      onSuccess: invalidate,
      meta: { success: "Code generated", error: "Couldn't generate a code" },
    }),
  );
}

export function useCancelCodeMutation() {
  const { orpc } = useRouteContext({ from: "/_shell/devices" });
  const invalidate = useInvalidatePendingCodes();
  return useMutation(
    orpc.device.cancelCode.mutationOptions({
      onSuccess: invalidate,
      meta: {
        success: "Enrolment removed",
        error: "Couldn't remove the enrolment",
      },
    }),
  );
}

// The editor sheet's one call: name and assignment together, so a Save
// round-trips once.
export function useUpdateDeviceMutation() {
  const { orpc } = useRouteContext({ from: "/_shell/devices" });
  const invalidate = useInvalidateDevices();
  return useMutation(
    orpc.device.update.mutationOptions({
      onSuccess: invalidate,
      meta: {
        success: "Device updated",
        error: "Couldn't update the device",
      },
    }),
  );
}

export function useRevokeDeviceMutation() {
  const { orpc } = useRouteContext({ from: "/_shell/devices" });
  const invalidate = useInvalidateDevices();
  return useMutation(
    orpc.device.revoke.mutationOptions({
      onSuccess: invalidate,
      meta: { error: "Couldn't revoke the device" },
    }),
  );
}
