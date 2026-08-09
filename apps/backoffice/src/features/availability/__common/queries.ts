import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";

export function useAvailabilityQuery(input: {
  storeId: string;
  page: number;
  perPage: number;
  search?: string;
  sort: { key: "name" | "menuItem" | "price" | "available"; direction: "asc" | "desc" };
}) {
  const { orpc } = useRouteContext({ from: "/_shell/availability" });
  return useQuery({
    ...orpc.availability.list.queryOptions({ input }),
    placeholderData: keepPreviousData,
  });
}
export function useSetAvailabilityMutation() {
  const { orpc } = useRouteContext({ from: "/_shell/availability" });
  const client = useQueryClient();
  return useMutation(
    orpc.availability.set.mutationOptions({
      meta: { silent: true },
      onSuccess: () =>
        client.invalidateQueries({
          predicate: (query) => String(query.queryKey[0]).includes("availability"),
        }),
    }),
  );
}
export function useStoresQuery() {
  const { orpc } = useRouteContext({ from: "/_shell/availability" });
  return useQuery(
    orpc.store.list.queryOptions({
      input: { page: 1, perPage: 1000, status: "active", sort: { key: "name", direction: "asc" } },
    }),
  );
}
