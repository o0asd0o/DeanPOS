import { useQueryClient } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";

export function useInvalidateCatalog() {
  const { orpc } = useRouteContext({ from: "/_shell/catalog" });
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: orpc.catalog.listCategories.queryKey() });
    void queryClient.invalidateQueries({ queryKey: orpc.catalog.listMenuItems.queryKey() });
  };
}

export function useInvalidateMenuItemEditor(menuItemId: string) {
  const { orpc } = useRouteContext({ from: "/_shell/catalog_/$id" });
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({
      queryKey: orpc.catalog.getMenuItem.queryKey({ input: { id: menuItemId } }),
    });
    void queryClient.invalidateQueries({
      queryKey: orpc.catalog.listVariants.queryKey({ input: { menuItemId } }),
    });
    void queryClient.invalidateQueries({ queryKey: orpc.catalog.listMenuItems.queryKey() });
    void queryClient.invalidateQueries({ queryKey: orpc.catalog.listCategories.queryKey() });
  };
}
