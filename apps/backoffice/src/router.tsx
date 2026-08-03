import { createRouter } from "@tanstack/react-router";
import { createQueryClient } from "ui";

import { ErrorState } from "./components/ErrorState.tsx";
import { NotFoundState } from "./components/NotFoundState.tsx";
import { routeTree } from "./generated/routeTree.gen.ts";
import { orpc } from "./lib/orpc.ts";

// Toasts every mutation's outcome — see `createQueryClient`.
export const queryClient = createQueryClient();

export const router = createRouter({
  routeTree,
  context: { queryClient, orpc },
  defaultErrorComponent: ({ reset }) => <ErrorState onRetry={reset} />,
  defaultNotFoundComponent: NotFoundState,
});

// Typed `Link`/`to` union — .scratch/decisions/008, pinned by tests/typed-routes.types.ts.
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
