import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";

import {
  useInvalidateCatalog,
  useInvalidateMenuItemEditor,
} from "@/features/catalog/__common/queries.ts";

export function useMenuItemsQuery() {
  const { orpc } = useRouteContext({ from: "/_shell/catalog" });
  return useQuery(orpc.catalog.listMenuItems.queryOptions());
}

export function useCreateMenuItemMutation() {
  const { orpc } = useRouteContext({ from: "/_shell/catalog" });
  const invalidate = useInvalidateCatalog();
  return useMutation(
    orpc.catalog.createMenuItem.mutationOptions({
      onSuccess: invalidate,
      meta: { success: "Menu item created", error: "Couldn't create the menu item" },
    }),
  );
}

export function useRenameMenuItemMutation() {
  const { orpc } = useRouteContext({ from: "/_shell/catalog" });
  const invalidate = useInvalidateCatalog();
  return useMutation(
    orpc.catalog.renameMenuItem.mutationOptions({
      onSuccess: invalidate,
      meta: { success: "Menu item saved", error: "Couldn't update the menu item" },
    }),
  );
}

export function useMoveMenuItemMutation() {
  const { orpc } = useRouteContext({ from: "/_shell/catalog" });
  const invalidate = useInvalidateCatalog();
  return useMutation(
    orpc.catalog.moveMenuItem.mutationOptions({
      onSuccess: invalidate,
      meta: { success: "Menu item moved", error: "Couldn't move the menu item" },
    }),
  );
}

export function useArchiveMenuItemMutation() {
  const { orpc } = useRouteContext({ from: "/_shell/catalog" });
  const invalidate = useInvalidateCatalog();
  return useMutation(
    orpc.catalog.archiveMenuItem.mutationOptions({
      onSuccess: invalidate,
      meta: { success: "Menu item archived", error: "Couldn't archive the menu item" },
    }),
  );
}

export function useReactivateMenuItemMutation() {
  const { orpc } = useRouteContext({ from: "/_shell/catalog" });
  const invalidate = useInvalidateCatalog();
  return useMutation(
    orpc.catalog.reactivateMenuItem.mutationOptions({
      onSuccess: invalidate,
      meta: { success: "Menu item reactivated", error: "Couldn't update the menu item" },
    }),
  );
}

export function useReorderMenuItemMutation() {
  const { orpc } = useRouteContext({ from: "/_shell/catalog" });
  const invalidate = useInvalidateCatalog();
  return useMutation(
    orpc.catalog.reorderMenuItem.mutationOptions({
      onSuccess: invalidate,
      meta: { success: "Menu item reordered", error: "Couldn't reorder the menu item" },
    }),
  );
}

export function useRenameMenuItemOnDetailMutation(menuItemId: string) {
  const { orpc } = useRouteContext({ from: "/_shell/catalog_/$id" });
  const invalidate = useInvalidateMenuItemEditor(menuItemId);
  return useMutation(
    orpc.catalog.renameMenuItem.mutationOptions({
      onSuccess: invalidate,
      meta: { error: "Couldn't save the menu item" },
    }),
  );
}

export function useMoveMenuItemOnDetailMutation(menuItemId: string) {
  const { orpc } = useRouteContext({ from: "/_shell/catalog_/$id" });
  const invalidate = useInvalidateMenuItemEditor(menuItemId);
  return useMutation(
    orpc.catalog.moveMenuItem.mutationOptions({
      onSuccess: invalidate,
      meta: { error: "Couldn't save the menu item" },
    }),
  );
}
