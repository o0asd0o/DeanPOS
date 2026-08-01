import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { createClient } from "contract/src/index.ts";

const apiUrl = import.meta.env.VITE_API_URL;

// Checked at first request, not at import, so the gate (which never makes one)
// stays green with VITE_API_URL unset — .scratch/decisions/012.
const client = createClient({
  url: `${apiUrl}/rpc`,
  fetch: (request, init) => {
    if (!apiUrl) throw new Error("VITE_API_URL is not set. See .env.example.");
    return fetch(request, init);
  },
});

export const orpc = createTanstackQueryUtils(client);
