import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";

import { useInvalidateCatalog } from "@/features/catalog/__common/queries.ts";

export function useCategoriesQuery() {
  const { orpc } = useRouteContext({ from: "/_shell/catalog" });
  return useQuery(orpc.catalog.listCategories.queryOptions());
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
