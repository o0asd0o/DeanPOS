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

function useInvalidateDevices() {
  const { orpc } = useRouteContext({ from: "/_shell/devices" });
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: orpc.device.list.queryKey() });
}

export function useGenerateCodeMutation() {
  const { orpc } = useRouteContext({ from: "/_shell/devices" });
  return useMutation(
    orpc.device.generateCode.mutationOptions({
      meta: { success: "Code generated", error: "Couldn't generate a code" },
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
