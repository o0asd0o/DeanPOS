import { z } from "zod";

import type { Handler } from "../../common/handler.ts";
import { checkDatabase } from "../db-operations/queries/check-database.query.ts";

export const inputSchema = z.void();

// Two separate booleans, nothing else. foundation PRD security criterion 4.
export const handler: Handler<void, { live: boolean; databaseReachable: boolean }> = async ({
  ctx,
}) => ({
  live: true,
  databaseReachable: await checkDatabase(ctx.db),
});
