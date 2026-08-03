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
  const { orpc } = useRouteContext({ from: "/_shell/employees" });
  return useQuery(orpc.user.list.queryOptions());
}

export function useStoresQuery() {
  const { orpc } = useRouteContext({ from: "/_shell/employees" });
  return useQuery(orpc.store.list.queryOptions());
}

export function useMeQuery() {
  const { orpc } = useRouteContext({ from: "/_shell/employees" });
  return useQuery(orpc.auth.me.queryOptions());
}

// Every mutation below invalidates the same list query on success — the
// list `Card` is the only place any of these results is read back.
function useInvalidateUsers() {
  const { orpc } = useRouteContext({ from: "/_shell/employees" });
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: orpc.user.list.queryKey() });
}

export function useCreateUserMutation() {
  const { orpc } = useRouteContext({ from: "/_shell/employees" });
  const invalidate = useInvalidateUsers();
  const queryClient = useQueryClient();
  const mutation = useMutation(
    orpc.user.create.mutationOptions({
      onSuccess: invalidate,
      meta: { success: "Employee created", error: "Couldn't create the employee" },
    }),
  );
  const evictPassword = () => evictMutation(queryClient, orpc.user.create.mutationKey());
  return { ...mutation, evictPassword };
}

export function useUpdateUserMutation() {
  const { orpc } = useRouteContext({ from: "/_shell/employees" });
  const invalidate = useInvalidateUsers();
  return useMutation(
    orpc.user.update.mutationOptions({
      onSuccess: invalidate,
      meta: { success: "Employee saved", error: "Couldn't update the employee" },
    }),
  );
}

export function useDeactivateUserMutation() {
  const { orpc } = useRouteContext({ from: "/_shell/employees" });
  const invalidate = useInvalidateUsers();
  return useMutation(
    orpc.user.deactivate.mutationOptions({
      onSuccess: invalidate,
      meta: { success: "Employee deactivated", error: "Couldn't update the employee" },
    }),
  );
}

export function useReactivateUserMutation() {
  const { orpc } = useRouteContext({ from: "/_shell/employees" });
  const invalidate = useInvalidateUsers();
  return useMutation(
    orpc.user.reactivate.mutationOptions({
      onSuccess: invalidate,
      meta: { success: "Employee reactivated", error: "Couldn't update the employee" },
    }),
  );
}

export function useResetUserPinMutation() {
  const { orpc } = useRouteContext({ from: "/_shell/employees" });
  return useMutation(
    orpc.user.resetPin.mutationOptions({
      meta: { success: "PIN reset", error: "Couldn't reset the PIN" },
    }),
  );
}

export function useResetUserPasswordMutation() {
  const { orpc } = useRouteContext({ from: "/_shell/employees" });
  const queryClient = useQueryClient();
  const mutation = useMutation(
    orpc.user.resetPassword.mutationOptions({
      meta: { success: "Temporary password set", error: "Couldn't reset the password" },
    }),
  );
  const evictPassword = () => evictMutation(queryClient, orpc.user.resetPassword.mutationKey());
  return { ...mutation, evictPassword };
}
