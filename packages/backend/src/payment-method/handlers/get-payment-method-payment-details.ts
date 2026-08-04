import { z } from "zod";

import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { getPaymentMethodPaymentDetails } from "../db-operations/queries/get-payment-method-payment-details.query.ts";

export const inputSchema = z.object({ id: z.string() });

type PaymentDetailsOutput = {
  accountName: string | null;
  accountNumber: string | null;
  image: { dataUrl: string; mime: string; sha256: string; byteLength: number } | null;
} | null;

// `admin` only (issue 14 acceptance criterion 9). Reads the Tenant-default
// row only — this screen has no Store context to override from.
export const handler: Handler<{ id: string }, PaymentDetailsOutput> = async ({ ctx, input }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.role) return null;
  const { tenantId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "admin")) return null;

  const row = await withTenantScope(ctx.db, tenantId, (scopedDb) =>
    getPaymentMethodPaymentDetails(scopedDb, input.id, null),
  );
  if (!row) return null;

  return {
    accountName: row.account_name,
    accountNumber: row.account_number,
    image: row.image_bytes
      ? {
          dataUrl: `data:${row.image_mime};base64,${row.image_bytes.toString("base64")}`,
          mime: row.image_mime!,
          sha256: row.image_sha256!,
          byteLength: row.image_byte_length!,
        }
      : null,
  };
};
