import { receiptInputSchema, receiptOutputSchema } from "contract/src/contract.ts";
import type { z } from "zod";

import { deviceCtx } from "../../common/ctx.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { getReceiptById } from "../db-operations/queries/get-receipt-by-id.query.ts";

export const inputSchema = receiptInputSchema;
type Input = z.infer<typeof inputSchema>;
type Output = z.infer<typeof receiptOutputSchema>;

export const handler: Handler<Input, Output> = async ({ ctx, input }) => {
  const deviceContext = deviceCtx(ctx);
  if (!deviceContext) return null;

  return withTenantScope(ctx.db, deviceContext.device.tenantId, async (db) => {
    const receipt = await getReceiptById(db, {
      id: input.id,
      storeId: deviceContext.device.storeId,
    });
    return receiptOutputSchema.parse(receipt);
  });
};
