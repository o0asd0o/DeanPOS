import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient } from "@orpc/contract";

import { contract } from "./contract.ts";

// The single client construction path. .scratch/decisions/006.
export function createClient(options: {
  url: string;
  fetch?: (request: Request, init?: RequestInit) => Promise<Response>;
}): ContractRouterClient<typeof contract> {
  return createORPCClient(new RPCLink(options));
}
