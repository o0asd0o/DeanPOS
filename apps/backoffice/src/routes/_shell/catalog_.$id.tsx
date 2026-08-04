import { createFileRoute } from "@tanstack/react-router";

import { MenuItemDetail } from "@/features/catalog/MenuItemDetail.tsx";

// Thin: wires /catalog/$id to the full-page MenuItem editor (issue 02 Direction pick).
export const Route = createFileRoute("/_shell/catalog_/$id")({
  staticData: { minRole: "manager" },
  component: MenuItemDetail,
});
