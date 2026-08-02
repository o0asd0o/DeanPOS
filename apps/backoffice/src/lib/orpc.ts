import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { createClient } from "contract/src/index.ts";

const apiUrl = import.meta.env.VITE_API_URL;

// Checked at first request, not at import, so the gate (which never makes one)
// stays green with VITE_API_URL unset — .scratch/decisions/012.
export const client = createClient({
  url: `${apiUrl}/rpc`,
  fetch: (request, init) => {
    if (!apiUrl) throw new Error("VITE_API_URL is not set. See .env.example.");
    // The API is on a different subdomain, so the default "same-origin" would
    // make the browser discard the session Set-Cookie (issue 03 round 2).
    return fetch(request, { ...init, credentials: "include" });
  },
});

export const orpc = createTanstackQueryUtils(client);
