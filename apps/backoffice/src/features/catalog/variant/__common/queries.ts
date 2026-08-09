import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";

import { useInvalidateMenuItemEditor } from "@/features/catalog/__common/queries.ts";

export function useCreateVariantMutation(menuItemId: string) {
  const { orpc } = useRouteContext({ from: "/_shell/catalog_/$id" });
  const invalidate = useInvalidateMenuItemEditor(menuItemId);
  return useMutation(
    orpc.catalog.createVariant.mutationOptions({
      onSuccess: invalidate,
      meta: { error: "Couldn't save the variant" },
    }),
  );
}

export function useRenameVariantMutation(menuItemId: string) {
  const { orpc } = useRouteContext({ from: "/_shell/catalog_/$id" });
  const invalidate = useInvalidateMenuItemEditor(menuItemId);
  return useMutation(
    orpc.catalog.renameVariant.mutationOptions({
      onSuccess: invalidate,
      meta: { error: "Couldn't save the variant" },
    }),
  );
}

export function useSetVariantPriceMutation(menuItemId: string) {
  const { orpc } = useRouteContext({ from: "/_shell/catalog_/$id" });
  const invalidate = useInvalidateMenuItemEditor(menuItemId);
  return useMutation(
    orpc.catalog.setVariantPrice.mutationOptions({
      onSuccess: invalidate,
      meta: { error: "Couldn't save the variant" },
    }),
  );
}

export function useArchiveVariantMutation(menuItemId: string) {
  const { orpc } = useRouteContext({ from: "/_shell/catalog_/$id" });
  const invalidate = useInvalidateMenuItemEditor(menuItemId);
  return useMutation(
    orpc.catalog.archiveVariant.mutationOptions({
      onSuccess: invalidate,
      meta: { error: "Couldn't archive the variant" },
    }),
  );
}

export function useReactivateVariantMutation(menuItemId: string) {
  const { orpc } = useRouteContext({ from: "/_shell/catalog_/$id" });
  const invalidate = useInvalidateMenuItemEditor(menuItemId);
  return useMutation(
    orpc.catalog.reactivateVariant.mutationOptions({
      onSuccess: invalidate,
      meta: { error: "Couldn't update the variant" },
    }),
  );
}

export function useReorderVariantMutation(menuItemId: string) {
  const { orpc } = useRouteContext({ from: "/_shell/catalog_/$id" });
  const invalidate = useInvalidateMenuItemEditor(menuItemId);
  return useMutation(
    orpc.catalog.reorderVariant.mutationOptions({
      onSuccess: invalidate,
      meta: { error: "Couldn't reorder the variant" },
    }),
  );
}

export function useAllModifierGroupsQuery() {
  const { orpc } = useRouteContext({ from: "/_shell/catalog_/$id" });
  return useQuery(orpc.catalog.listModifierGroups.queryOptions());
}

export function useAllAddOnsQuery() {
  const { orpc } = useRouteContext({ from: "/_shell/catalog_/$id" });
  return useQuery(orpc.catalog.listAddOns.queryOptions());
}

export function useLinkedAddOnsForItemQuery(menuItemId: string | null) {
  const { orpc } = useRouteContext({ from: "/_shell/catalog_/$id" });
  return useQuery({
    ...orpc.catalog.listLinkedAddOnsForMenuItem.queryOptions({
      input: { menuItemId: menuItemId ?? "" },
    }),
    enabled: Boolean(menuItemId),
  });
}

function useInvalidateAddOnsForItem(menuItemId: string) {
  const { orpc } = useRouteContext({ from: "/_shell/catalog_/$id" });
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({
      queryKey: orpc.catalog.listLinkedAddOnsForMenuItem.queryKey({ input: { menuItemId } }),
    });
    void queryClient.invalidateQueries({ queryKey: orpc.catalog.listAddOns.queryKey() });
  };
}

export function useLinkAddOnToItemMutation(menuItemId: string) {
  const { orpc } = useRouteContext({ from: "/_shell/catalog_/$id" });
  const invalidate = useInvalidateAddOnsForItem(menuItemId);
  return useMutation(
    orpc.catalog.linkAddOnToMenuItem.mutationOptions({
      onSuccess: invalidate,
      meta: { silent: true },
    }),
  );
}

export function useUnlinkAddOnFromItemMutation(menuItemId: string) {
  const { orpc } = useRouteContext({ from: "/_shell/catalog_/$id" });
  const invalidate = useInvalidateAddOnsForItem(menuItemId);
  return useMutation(
    orpc.catalog.unlinkAddOnFromMenuItem.mutationOptions({
      onSuccess: invalidate,
      meta: { silent: true },
    }),
  );
}

export function useLinkedModifierGroupsForItemQuery(menuItemId: string | null) {
  const { orpc } = useRouteContext({ from: "/_shell/catalog_/$id" });
  return useQuery({
    ...orpc.catalog.listLinkedModifierGroupsForMenuItem.queryOptions({
      input: { menuItemId: menuItemId ?? "" },
    }),
    enabled: Boolean(menuItemId),
  });
}

function useInvalidateLinkedForItem(menuItemId: string) {
  const { orpc } = useRouteContext({ from: "/_shell/catalog_/$id" });
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({
      queryKey: orpc.catalog.listLinkedModifierGroupsForMenuItem.queryKey({
        input: { menuItemId },
      }),
    });
    void queryClient.invalidateQueries({
      queryKey: orpc.catalog.listModifierGroups.queryKey(),
    });
  };
}

export function useLinkModifierGroupToItemMutation(menuItemId: string) {
  const { orpc } = useRouteContext({ from: "/_shell/catalog_/$id" });
  const invalidate = useInvalidateLinkedForItem(menuItemId);
  return useMutation(
    orpc.catalog.linkModifierGroupToMenuItem.mutationOptions({
      onSuccess: invalidate,
      meta: { silent: true },
    }),
  );
}

export function useUnlinkModifierGroupFromItemMutation(menuItemId: string) {
  const { orpc } = useRouteContext({ from: "/_shell/catalog_/$id" });
  const invalidate = useInvalidateLinkedForItem(menuItemId);
  return useMutation(
    orpc.catalog.unlinkModifierGroupFromMenuItem.mutationOptions({
      onSuccess: invalidate,
      meta: { silent: true },
    }),
  );
}
