import { z } from "zod";

import type { Handler } from "../../common/handler.ts";
import { getPing } from "../db-operations/queries/get-ping.query.ts";

export const inputSchema = z.void();

export const handler: Handler<void, Awaited<ReturnType<typeof getPing>>> = ({ ctx }) =>
  getPing(ctx.db);
