import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";

export function useStoresQuery() {
  const { orpc } = useRouteContext({ from: "/_shell/stores" });
  return useQuery(orpc.store.list.queryOptions());
}

export function useMeQuery() {
  const { orpc } = useRouteContext({ from: "/_shell/stores" });
  return useQuery(orpc.auth.me.queryOptions());
}

// Every mutation below invalidates the same list query on success — the
// list `Card` is the only place any of these results is read back.
function useInvalidateStores() {
  const { orpc } = useRouteContext({ from: "/_shell/stores" });
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: orpc.store.list.queryKey() });
}

export function useCreateStoreMutation() {
  const { orpc } = useRouteContext({ from: "/_shell/stores" });
  const invalidate = useInvalidateStores();
  return useMutation(orpc.store.create.mutationOptions({ onSuccess: invalidate }));
}

export function useUpdateStoreMutation() {
  const { orpc } = useRouteContext({ from: "/_shell/stores" });
  const invalidate = useInvalidateStores();
  return useMutation(orpc.store.update.mutationOptions({ onSuccess: invalidate }));
}

export function useDeactivateStoreMutation() {
  const { orpc } = useRouteContext({ from: "/_shell/stores" });
  const invalidate = useInvalidateStores();
  return useMutation(orpc.store.deactivate.mutationOptions({ onSuccess: invalidate }));
}

export function useReactivateStoreMutation() {
  const { orpc } = useRouteContext({ from: "/_shell/stores" });
  const invalidate = useInvalidateStores();
  return useMutation(orpc.store.reactivate.mutationOptions({ onSuccess: invalidate }));
}
