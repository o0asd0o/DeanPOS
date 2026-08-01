import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AnyRouter } from "@tanstack/react-router";
import { RouterProvider } from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import axe from "axe-core";
import { createClient } from "contract/src/index.ts";
import { afterEach, expect } from "vite-plus/test";

import { createTestSeam, type TestSeamOptions } from "./test-seam.ts";

// RTL's auto-cleanup needs a global afterEach; this repo has none (house
// style imports test functions explicitly). One registration, here, covers
// every render that goes through this helper. .scratch/decisions/008.
afterEach(cleanup);

export { fireEvent, screen, waitFor, within };

/**
 * The render half of the one test seam (server half: ./test-seam.ts).
 *
 * Renders `router` — a router your own app already built in its own
 * `src/router.tsx`, real routeTree and all — wired to a fresh, test-scoped
 * TanStack Query client whose oRPC client dispatches into the Hono
 * application in-process via `app.request()`, backed by the lane database.
 * No HTTP port, no mocked client, no mock of anything DeanPOS owns.
 *
 * The test-scoped `QueryClient` is built with `retry: false`, so a query
 * against a deliberately-broken database surfaces its error state in one
 * tick instead of retrying three times and timing the test out. It is
 * injected through TanStack Router's render-time `context` override, not by
 * rebuilding the router, so the router under test is byte-identical to the
 * one that ships.
 *
 * Usage, unchanged for every area that has a router:
 *
 *   import { renderRoute } from "api/src/test-seam-react.tsx";
 *   import { router } from "../src/router.tsx";
 *
 *   const { container, db } = renderRoute({ router });
 *
 * `options` also accepts `databaseUrl`/`appDomain` overrides, passed through
 * to `createTestSeam` — see ./test-seam.ts.
 */
export function renderRoute<TRouter extends AnyRouter>(
  options: { router: TRouter } & TestSeamOptions,
): { container: HTMLElement; db: ReturnType<typeof createTestSeam>["db"] } {
  const { router, ...seamOptions } = options;
  const seam = createTestSeam(seamOptions);

  const client = createClient({
    url: "http://api.test/rpc",
    fetch: async (request, init) => seam.app.request(request, init),
  });
  const orpc = createTanstackQueryUtils(client);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const { container } = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} context={{ queryClient, orpc }} />
    </QueryClientProvider>,
  );

  return { container, db: seam.db };
}

/**
 * Runs axe-core's WCAG 2.2 AA rule set against `container`. `color-contrast`
 * is the only disabled rule: no virtual DOM has a layout or a Range API to
 * sample rendered pixels with, so contrast is covered instead by
 * packages/ui/tests/contrast.test.ts over the token pairs. No other rule may
 * be disabled without a new .scratch/decisions/ record.
 */
export async function expectNoAxeViolations(container: Element): Promise<void> {
  const results = await axe.run(container, {
    runOnly: {
      type: "tag",
      values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
    },
    rules: { "color-contrast": { enabled: false } },
  });

  expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
}

const SERVER_IMPORT_PATTERN = /\bfrom\s+["'](api|backend|hono|@orpc\/server)(\/[^"']*)?["']/;

function collectFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    return statSync(fullPath).isDirectory() ? collectFiles(fullPath) : [fullPath];
  });
}

/**
 * The devDependency boundary, enforced rather than reviewed: no file under
 * an application's `src/` may import `api`, `backend`, `hono`, or
 * `@orpc/server` — those reach the seam and only the seam.
 * .scratch/decisions/006, made executable by .scratch/decisions/008.
 */
export function assertNoServerImports(srcDir: string): void {
  const offenders = collectFiles(srcDir)
    .filter((filePath) => /\.tsx?$/.test(filePath))
    .filter((filePath) => SERVER_IMPORT_PATTERN.test(readFileSync(filePath, "utf8")));

  if (offenders.length > 0) {
    throw new Error(`Server-only imports found in:\n${offenders.join("\n")}`);
  }
}
