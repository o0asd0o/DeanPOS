import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_shell/")({
  staticData: { minRole: "cashier" },
  beforeLoad: () => {
    throw redirect({ to: "/reports/summary" });
  },
});
