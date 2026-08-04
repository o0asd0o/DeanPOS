import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";

export function useCategoriesQuery() {
  const { orpc } = useRouteContext({ from: "/_shell/catalog" });
  return useQuery(orpc.catalog.listCategories.queryOptions());
}

export function useMenuItemsQuery() {
  const { orpc } = useRouteContext({ from: "/_shell/catalog" });
  return useQuery(orpc.catalog.listMenuItems.queryOptions());
}

function useInvalidateCatalog() {
  const { orpc } = useRouteContext({ from: "/_shell/catalog" });
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: orpc.catalog.listCategories.queryKey() });
    void queryClient.invalidateQueries({ queryKey: orpc.catalog.listMenuItems.queryKey() });
  };
}

export function useCreateCategoryMutation() {
  const { orpc } = useRouteContext({ from: "/_shell/catalog" });
  const invalidate = useInvalidateCatalog();
  return useMutation(
    orpc.catalog.createCategory.mutationOptions({
      onSuccess: invalidate,
      meta: { success: "Category created", error: "Couldn't create the category" },
    }),
  );
}

export function useRenameCategoryMutation() {
  const { orpc } = useRouteContext({ from: "/_shell/catalog" });
  const invalidate = useInvalidateCatalog();
  return useMutation(
    orpc.catalog.renameCategory.mutationOptions({
      onSuccess: invalidate,
      meta: { success: "Category saved", error: "Couldn't update the category" },
    }),
  );
}

export function useArchiveCategoryMutation() {
  const { orpc } = useRouteContext({ from: "/_shell/catalog" });
  const invalidate = useInvalidateCatalog();
  return useMutation(
    orpc.catalog.archiveCategory.mutationOptions({
      onSuccess: invalidate,
      meta: { success: "Category archived", error: "Couldn't archive the category" },
    }),
  );
}

export function useReactivateCategoryMutation() {
  const { orpc } = useRouteContext({ from: "/_shell/catalog" });
  const invalidate = useInvalidateCatalog();
  return useMutation(
    orpc.catalog.reactivateCategory.mutationOptions({
      onSuccess: invalidate,
      meta: { success: "Category reactivated", error: "Couldn't update the category" },
    }),
  );
}

export function useReorderCategoryMutation() {
  const { orpc } = useRouteContext({ from: "/_shell/catalog" });
  const invalidate = useInvalidateCatalog();
  return useMutation(
    orpc.catalog.reorderCategory.mutationOptions({
      onSuccess: invalidate,
      meta: { success: "Category reordered", error: "Couldn't reorder the category" },
    }),
  );
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
