import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";

const silent = { silent: true as const };

export function useDiscountsQuery() {
  const { orpc } = useRouteContext({ from: "/_shell/discounts" });
  return useQuery(orpc.catalog.listDiscounts.queryOptions());
}

export function useStoresQuery() {
  const { orpc } = useRouteContext({ from: "/_shell/discounts" });
  return useQuery(
    orpc.store.list.queryOptions({
      input: { page: 1, perPage: 1000, status: "active", sort: { key: "name", direction: "asc" } },
    }),
  );
}

function useInvalidateDiscounts() {
  const { orpc } = useRouteContext({ from: "/_shell/discounts" });
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: orpc.catalog.listDiscounts.queryKey() });
}

export function useCreateDiscountMutation() {
  const { orpc } = useRouteContext({ from: "/_shell/discounts" });
  const invalidate = useInvalidateDiscounts();
  return useMutation(
    orpc.catalog.createDiscount.mutationOptions({ onSuccess: invalidate, meta: silent }),
  );
}

export function useUpdateDiscountMutation() {
  const { orpc } = useRouteContext({ from: "/_shell/discounts" });
  const invalidate = useInvalidateDiscounts();
  return useMutation(
    orpc.catalog.updateDiscount.mutationOptions({ onSuccess: invalidate, meta: silent }),
  );
}

export function useArchiveDiscountMutation() {
  const { orpc } = useRouteContext({ from: "/_shell/discounts" });
  const invalidate = useInvalidateDiscounts();
  return useMutation(
    orpc.catalog.archiveDiscount.mutationOptions({ onSuccess: invalidate, meta: silent }),
  );
}

export function useReactivateDiscountMutation() {
  const { orpc } = useRouteContext({ from: "/_shell/discounts" });
  const invalidate = useInvalidateDiscounts();
  return useMutation(
    orpc.catalog.reactivateDiscount.mutationOptions({ onSuccess: invalidate, meta: silent }),
  );
}
