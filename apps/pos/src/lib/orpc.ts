import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { createClient } from "contract/src/index.ts";

// The production client. Origin wiring (VITE_APP_DOMAIN) lands with issue 08.
const client = createClient({ url: `https://api.${import.meta.env.VITE_APP_DOMAIN}/rpc` });

export const orpc = createTanstackQueryUtils(client);
