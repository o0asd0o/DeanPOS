import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { createClient } from "contract/src/index.ts";

import { readDeviceToken } from "./device-token.ts";

const apiUrl = import.meta.env.VITE_API_URL;

// Checked at first request, not at import, so the gate (which never makes one)
// stays green with VITE_API_URL unset — .scratch/decisions/012. The Device
// token rides `Authorization`, never a cookie (record 056 Q3).
const client = createClient({
  url: `${apiUrl}/rpc`,
  fetch: (request, init) => {
    if (!apiUrl) throw new Error("VITE_API_URL is not set. See .env.example.");
    const token = readDeviceToken();
    if (token) request.headers.set("Authorization", `Bearer ${token}`);
    return fetch(request, init);
  },
});

export const orpc = createTanstackQueryUtils(client);
