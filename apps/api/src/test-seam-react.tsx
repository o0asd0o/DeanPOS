import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { hashPassword } from "backend/src/common/password.ts";
import type { Principal } from "backend/src/common/ctx.ts";
import { createDb, withTenantScope } from "backend/src/db/client.ts";
import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type AnyRouter, createRouter, RouterProvider } from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import axe from "axe-core";
import { createClient } from "contract/src/index.ts";
import { createQueryClient, Toaster } from "ui";
import { afterEach, expect } from "vite-plus/test";

import { createTestSeam, type TestSeamOptions } from "./test-seam.ts";

// RTL's auto-cleanup needs a global afterEach; this repo has none (house
// style imports test functions explicitly). One registration, here, covers
// every render that goes through this helper. .scratch/decisions/008.
afterEach(cleanup);

export { cleanup, fireEvent, render, screen, waitFor, within };

// Fixture operations for a UI-app test file (finding 12, ADR-0009): a UI
// app's test suite goes through `api`'s seam, never `backend` directly.
export { createDb, hashPassword, withTenantScope };

// The render half of the one test seam (server half: ./test-seam.ts).
// Public surface: .scratch/decisions/008. `tenantId` (issue 03) is the
// direct-principal path, not a real cookie — see the issue's `## Comments`.
export function renderRoute<TRouter extends AnyRouter>(
  options: {
    router: TRouter;
    tenantId?: string;
    mustChangePassword?: boolean;
    email?: string;
    initialLocation?: string;
    userId?: string;
    role?: Principal["role"];
  } & TestSeamOptions,
): {
  container: HTMLElement;
  db: ReturnType<typeof createTestSeam>["db"];
  queryClient: QueryClient;
} {
  const {
    router,
    tenantId,
    mustChangePassword,
    email,
    initialLocation,
    userId,
    role,
    ...seamOptions
  } = options;
  if (initialLocation) window.history.pushState(null, "", initialLocation);

  const seam = createTestSeam(seamOptions);
  const actor = tenantId
    ? seam.actors.asTenant(tenantId, { mustChangePassword, userId, role, email })
    : seam;

  const client = createClient({
    url: "http://api.test/rpc",
    fetch: async (request, init) => {
      // Same per-seam throttle bucket as the server seam: without this every
      // React screen test shares `ip:no-forwarded-for` (records 033–034).
      request.headers.set("X-Forwarded-For", seam.clientIp);
      // Mirrors apps/pos/src/lib/orpc.ts's own fetch wrapper (record 056):
      // a Device-token request rides `Authorization`. Backoffice tests never
      // set this key, so this is a no-op there.
      const deviceToken = localStorage.getItem("deanpos.device.token");
      if (deviceToken) request.headers.set("Authorization", `Bearer ${deviceToken}`);
      return actor.app.request(request, init);
    },
  });
  const orpc = createTanstackQueryUtils(client);
  // The app's own client, so mutation toasts fire in tests exactly as they do
  // in the browser.
  const queryClient = createQueryClient({ defaultOptions: { queries: { retry: false } } });
  const testRouter = createRouter({
    ...router.options,
    context: { queryClient, orpc },
  });

  const { container } = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={testRouter} />
      <Toaster />
    </QueryClientProvider>,
  );

  return { container, db: seam.db, queryClient };
}

// Runs axe's WCAG 2.2 AA rule set against `container`. Disabled-rule list
// and rationale: .scratch/decisions/008, "The accessibility assertion".
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

// The devDependency boundary, enforced rather than reviewed.
// .scratch/decisions/006, made executable by .scratch/decisions/008.
export function assertNoServerImports(srcDir: string): void {
  const offenders = collectFiles(srcDir)
    .filter((filePath) => /\.tsx?$/.test(filePath))
    .filter((filePath) => SERVER_IMPORT_PATTERN.test(readFileSync(filePath, "utf8")));

  if (offenders.length > 0) {
    throw new Error(`Server-only imports found in:\n${offenders.join("\n")}`);
  }
}
