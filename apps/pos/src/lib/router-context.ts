import type { QueryClient } from "@tanstack/react-query";

import type { orpc } from "./orpc.ts";

export type Orpc = typeof orpc;

// Injected per render: the production singleton in main.tsx, a seam-built
// instance in the test seam (apps/api/src/test-seam-react.tsx).
export type RouterContext = {
  queryClient: QueryClient;
  orpc: Orpc;
};
