import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";

export function useModifierGroupsQuery() {
  const { orpc } = useRouteContext({ from: "/_shell/add-ons" });
  return useQuery(orpc.catalog.listModifierGroups.queryOptions());
}

export function useMeQuery() {
  const { orpc } = useRouteContext({ from: "/_shell/add-ons" });
  return useQuery(orpc.auth.me.queryOptions());
}

function useInvalidateOptions() {
  const { orpc } = useRouteContext({ from: "/_shell/add-ons" });
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: orpc.catalog.listModifierGroups.queryKey() });
  };
}

const silent = { silent: true as const };

export function useCreateModifierGroupMutation() {
  const { orpc } = useRouteContext({ from: "/_shell/add-ons" });
  const invalidate = useInvalidateOptions();
  return useMutation(
    orpc.catalog.createModifierGroup.mutationOptions({
      onSuccess: invalidate,
      meta: silent,
    }),
  );
}

export function useUpdateModifierGroupMutation() {
  const { orpc } = useRouteContext({ from: "/_shell/add-ons" });
  const invalidate = useInvalidateOptions();
  return useMutation(
    orpc.catalog.updateModifierGroup.mutationOptions({
      onSuccess: invalidate,
      meta: silent,
    }),
  );
}

export function useArchiveModifierGroupMutation() {
  const { orpc } = useRouteContext({ from: "/_shell/add-ons" });
  const invalidate = useInvalidateOptions();
  return useMutation(
    orpc.catalog.archiveModifierGroup.mutationOptions({
      onSuccess: invalidate,
      meta: silent,
    }),
  );
}

export function useReactivateModifierGroupMutation() {
  const { orpc } = useRouteContext({ from: "/_shell/add-ons" });
  const invalidate = useInvalidateOptions();
  return useMutation(
    orpc.catalog.reactivateModifierGroup.mutationOptions({
      onSuccess: invalidate,
      meta: silent,
    }),
  );
}

export function useReorderModifierGroupMutation() {
  const { orpc } = useRouteContext({ from: "/_shell/add-ons" });
  const invalidate = useInvalidateOptions();
  return useMutation(
    orpc.catalog.reorderModifierGroup.mutationOptions({
      onSuccess: invalidate,
      meta: silent,
    }),
  );
}

export function useCreateModifierMutation() {
  const { orpc } = useRouteContext({ from: "/_shell/add-ons" });
  const invalidate = useInvalidateOptions();
  return useMutation(
    orpc.catalog.createModifier.mutationOptions({
      onSuccess: invalidate,
      meta: silent,
    }),
  );
}

export function useUpdateModifierMutation() {
  const { orpc } = useRouteContext({ from: "/_shell/add-ons" });
  const invalidate = useInvalidateOptions();
  return useMutation(
    orpc.catalog.updateModifier.mutationOptions({
      onSuccess: invalidate,
      meta: silent,
    }),
  );
}

export function useArchiveModifierMutation() {
  const { orpc } = useRouteContext({ from: "/_shell/add-ons" });
  const invalidate = useInvalidateOptions();
  return useMutation(
    orpc.catalog.archiveModifier.mutationOptions({
      onSuccess: invalidate,
      meta: silent,
    }),
  );
}

export function useReactivateModifierMutation() {
  const { orpc } = useRouteContext({ from: "/_shell/add-ons" });
  const invalidate = useInvalidateOptions();
  return useMutation(
    orpc.catalog.reactivateModifier.mutationOptions({
      onSuccess: invalidate,
      meta: silent,
    }),
  );
}

export function useReorderModifierMutation() {
  const { orpc } = useRouteContext({ from: "/_shell/add-ons" });
  const invalidate = useInvalidateOptions();
  return useMutation(
    orpc.catalog.reorderModifier.mutationOptions({
      onSuccess: invalidate,
      meta: silent,
    }),
  );
}
