import { createFileRoute } from "@tanstack/react-router";

import { SalePrototype } from "@/features/sale-prototype/SalePrototype.tsx";

// Throwaway: sale-screen layout variants on ?variant=A|B|C. Delete once one wins.
export const Route = createFileRoute("/prototype-sale")({
  validateSearch: (search: Record<string, unknown>) => ({
    variant: search.variant === "B" || search.variant === "C" ? search.variant : "A",
  }),
  component: SalePrototype,
});
