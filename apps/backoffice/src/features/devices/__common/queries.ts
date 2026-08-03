import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";

export function useDevicesQuery() {
  const { orpc } = useRouteContext({ from: "/_shell/devices" });
  return useQuery(orpc.device.list.queryOptions());
}

export function useStoresQuery() {
  const { orpc } = useRouteContext({ from: "/_shell/devices" });
  return useQuery(orpc.store.list.queryOptions());
}

export function useMeQuery() {
  const { orpc } = useRouteContext({ from: "/_shell/devices" });
  return useQuery(orpc.auth.me.queryOptions());
}

// Same key as the list, so one poll both closes the enrolment dialog and
// refreshes the table underneath it.
export function useEnrolmentWatchQuery(enabled: boolean) {
  const { orpc } = useRouteContext({ from: "/_shell/devices" });
  return useQuery({ ...orpc.device.list.queryOptions(), enabled, refetchInterval: 3000 });
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
  return () => queryClient.invalidateQueries({ queryKey: orpc.device.pendingCodes.queryKey() });
}

function useInvalidateDevices() {
  const { orpc } = useRouteContext({ from: "/_shell/devices" });
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: orpc.device.list.queryKey() });
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
      meta: { success: "Enrolment removed", error: "Couldn't remove the enrolment" },
    }),
  );
}

export function useRenameDeviceMutation() {
  const { orpc } = useRouteContext({ from: "/_shell/devices" });
  const invalidate = useInvalidateDevices();
  return useMutation(
    orpc.device.rename.mutationOptions({
      onSuccess: invalidate,
      meta: { success: "Renamed", error: "Couldn't rename the device" },
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
