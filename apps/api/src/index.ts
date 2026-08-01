import { createDb } from "backend/src/db/client.ts";

import { createApp } from "./app.ts";
import { loadEnv } from "./env.ts";

const env = loadEnv();
const db = createDb({ databaseUrl: env.databaseUrl });

export default createApp({ db, appDomain: env.appDomain });
