import { useMutation } from "@tanstack/react-query";
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
