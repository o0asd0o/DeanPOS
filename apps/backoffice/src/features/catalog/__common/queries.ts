import { useQueryClient } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";

export function useInvalidateCatalog() {
  const { orpc } = useRouteContext({ from: "/_shell/catalog" });
  const queryClient = useQueryClient();
  const menuItemsPath = orpc.catalog.listMenuItems.queryKey({ input: {} })[0];
  return () => {
    void queryClient.invalidateQueries({ queryKey: orpc.catalog.listCategories.queryKey() });
    void queryClient.invalidateQueries({ queryKey: [menuItemsPath] });
  };
}

export function useInvalidateMenuItemEditor(menuItemId: string) {
  const { orpc } = useRouteContext({ from: "/_shell/catalog_/$id" });
  const queryClient = useQueryClient();
  const menuItemsPath = orpc.catalog.listMenuItems.queryKey({ input: {} })[0];
  return () => {
    void queryClient.invalidateQueries({
      queryKey: orpc.catalog.getMenuItem.queryKey({ input: { id: menuItemId } }),
    });
    void queryClient.invalidateQueries({
      queryKey: orpc.catalog.listVariants.queryKey({ input: { menuItemId } }),
    });
    void queryClient.invalidateQueries({ queryKey: [menuItemsPath] });
    void queryClient.invalidateQueries({ queryKey: orpc.catalog.listCategories.queryKey() });
  };
}
