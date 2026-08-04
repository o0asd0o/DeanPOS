import { createFileRoute } from "@tanstack/react-router";

import { PaymentMethods } from "@/features/payment-methods/PaymentMethods.tsx";

// Thin: wires the route to the feature and nothing else (ADR-0009, record 038 §1).
// `admin` only — the handlers already refuse below it (issue 15, record 063 §4).
export const Route = createFileRoute("/_shell/payment-methods")({
  staticData: { minRole: "admin" },
  component: PaymentMethods,
});
