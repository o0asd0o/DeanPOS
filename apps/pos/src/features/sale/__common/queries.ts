import { useQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";

import { readDeviceIdentity } from "@/lib/device-token.ts";

export function useCatalogQuery() {
  const { orpc } = useRouteContext({ from: "/" });
  const storeId = readDeviceIdentity()?.storeId;
  return useQuery({
    ...orpc.catalog.read.queryOptions({ input: { storeId: storeId ?? "" } }),
    enabled: storeId !== undefined,
  });
}
