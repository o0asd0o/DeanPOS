import { OverrideListCard } from "./OverrideListCard.tsx";
import { useOverridesQuery } from "./__common/queries.ts";

// The Discounts & overrides placeholder, filled (issue 12, record 060 Q5).
// `manager`-or-above only — the route's own `beforeLoad` gate.
export function Overrides() {
  const overridesQuery = useOverridesQuery();

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold">Discounts &amp; overrides</h1>
      <OverrideListCard
        overrides={overridesQuery.data ?? undefined}
        isPending={overridesQuery.isPending}
        isError={overridesQuery.isError}
        isFetching={overridesQuery.isFetching}
        refetch={() => overridesQuery.refetch()}
      />
    </div>
  );
}
