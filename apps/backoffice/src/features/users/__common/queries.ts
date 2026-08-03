import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MutationKey, QueryClient } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";

// `reset()` only detaches the observer — the password-bearing variables stay
// in MutationCache for its GC window (record 043 no-go 8). This removes the
// entry outright.
function evictMutation(queryClient: QueryClient, mutationKey: MutationKey) {
  for (const mutation of queryClient.getMutationCache().findAll({ mutationKey })) {
    queryClient.getMutationCache().remove(mutation);
  }
}

export function useUsersQuery() {
  const { orpc } = useRouteContext({ from: "/_shell/users" });
  return useQuery(orpc.user.list.queryOptions());
}

export function useStoresQuery() {
  const { orpc } = useRouteContext({ from: "/_shell/users" });
  return useQuery(orpc.store.list.queryOptions());
}

export function useMeQuery() {
  const { orpc } = useRouteContext({ from: "/_shell/users" });
  return useQuery(orpc.auth.me.queryOptions());
}

// Every mutation below invalidates the same list query on success — the
// list `Card` is the only place any of these results is read back.
function useInvalidateUsers() {
  const { orpc } = useRouteContext({ from: "/_shell/users" });
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: orpc.user.list.queryKey() });
}

export function useCreateUserMutation() {
  const { orpc } = useRouteContext({ from: "/_shell/users" });
  const invalidate = useInvalidateUsers();
  const queryClient = useQueryClient();
  const mutation = useMutation(orpc.user.create.mutationOptions({ onSuccess: invalidate }));
  const evictPassword = () => evictMutation(queryClient, orpc.user.create.mutationKey());
  return { ...mutation, evictPassword };
}

export function useUpdateUserMutation() {
  const { orpc } = useRouteContext({ from: "/_shell/users" });
  const invalidate = useInvalidateUsers();
  return useMutation(orpc.user.update.mutationOptions({ onSuccess: invalidate }));
}

export function useDeactivateUserMutation() {
  const { orpc } = useRouteContext({ from: "/_shell/users" });
  const invalidate = useInvalidateUsers();
  return useMutation(orpc.user.deactivate.mutationOptions({ onSuccess: invalidate }));
}

export function useReactivateUserMutation() {
  const { orpc } = useRouteContext({ from: "/_shell/users" });
  const invalidate = useInvalidateUsers();
  return useMutation(orpc.user.reactivate.mutationOptions({ onSuccess: invalidate }));
}

export function useResetUserPasswordMutation() {
  const { orpc } = useRouteContext({ from: "/_shell/users" });
  const queryClient = useQueryClient();
  const mutation = useMutation(orpc.user.resetPassword.mutationOptions());
  const evictPassword = () => evictMutation(queryClient, orpc.user.resetPassword.mutationKey());
  return { ...mutation, evictPassword };
}
