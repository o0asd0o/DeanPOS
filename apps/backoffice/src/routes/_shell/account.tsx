import { createFileRoute } from "@tanstack/react-router";

import { Account } from "@/features/account/Account.tsx";

// Thin: wires the route to the feature and nothing else (ADR-0009). `cashier`
// — reached from `UserMenu`, not the sidebar (issue 15, record 063 Amendment 1).
export const Route = createFileRoute("/_shell/account")({
  staticData: { minRole: "cashier" },
  component: Account,
});
