import { createFileRoute } from "@tanstack/react-router";

import { PaymentMethods } from "@/features/payment-methods/PaymentMethods.tsx";

// Thin: wires the route to the feature and nothing else (ADR-0009, record 038 §1).
export const Route = createFileRoute("/_shell/payment-methods")({
  component: PaymentMethods,
});
