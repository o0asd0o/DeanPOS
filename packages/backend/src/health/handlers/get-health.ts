import { z } from "zod";

import type { Handler } from "../../common/handler.ts";
import { checkDatabase } from "../db-operations/queries/check-database.query.ts";

export const inputSchema = z.void();

/**
 * Liveness and database reachability as two separate booleans — "the
 * container booted" and "the app can serve" are different answers
 * (security criterion 4). Discloses nothing else: no version, no
 * connection details, no stack trace.
 */
export const handler: Handler<void, { live: boolean; databaseReachable: boolean }> = async ({
  ctx,
}) => ({
  live: true,
  databaseReachable: await checkDatabase(ctx.db),
});
