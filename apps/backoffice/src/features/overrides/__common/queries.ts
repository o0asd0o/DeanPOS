import { useQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";

export function useOverridesQuery() {
  const { orpc } = useRouteContext({ from: "/_shell/reports/discounts-overrides" });
  return useQuery(orpc.override.list.queryOptions());
}
