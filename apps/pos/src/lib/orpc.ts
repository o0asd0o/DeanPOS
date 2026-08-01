import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { createClient } from "contract/src/index.ts";

const client = createClient({ url: `${import.meta.env.VITE_API_URL}/rpc` });

export const orpc = createTanstackQueryUtils(client);
