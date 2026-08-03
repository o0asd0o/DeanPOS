import type { DatabaseInstance } from "../../../db/client.ts";

// Every availability row for the caller's Tenant (RLS-confined), grouped by
// the handler into per-method storeId lists. `cash` holds no rows here.
export const listPaymentMethodAvailability = (db: DatabaseInstance) =>
  db.selectFrom("PaymentMethodAvailability").select(["payment_method_id", "store_id"]).execute();
