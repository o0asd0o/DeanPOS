import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient } from "@orpc/contract";

import { contract } from "./contract.ts";

/**
 * The single client construction path (.scratch/decisions/006). Built once
 * here rather than in each app, so the `fetch` injection point is shared by
 * both browsers and by the in-process test seam: production omits `fetch`
 * and oRPC uses the global; the seam supplies one that dispatches straight
 * into the Hono application via `app.request()`.
 */
export function createClient(options: {
  url: string;
  fetch?: (request: Request, init?: RequestInit) => Promise<Response>;
}): ContractRouterClient<typeof contract> {
  return createORPCClient(new RPCLink(options));
}
