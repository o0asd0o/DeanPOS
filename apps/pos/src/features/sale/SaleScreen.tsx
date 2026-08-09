import { ErrorState } from "@/components/ErrorState.tsx";
import { SaleWorkspace } from "./SaleWorkspace.tsx";
import { useCatalogQuery } from "./__common/queries.ts";

export function SaleScreen() {
  const catalog = useCatalogQuery();
  if (catalog.isPending)
    return (
      <p role="status" className="p-4">
        Loading menu…
      </p>
    );
  if (catalog.isError || !catalog.data)
    return <ErrorState onRetry={() => catalog.refetch()} isFetching={catalog.isFetching} />;

  return <SaleWorkspace catalog={catalog.data} />;
}
