import { deviceCtx } from "../../common/ctx.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { getStore } from "../../store/db-operations/queries/get-store.query.ts";

type MeResult =
  | {
      authenticated: true;
      deviceId: string;
      name: string;
      code: string;
      storeId: string;
      storeName: string;
    }
  | { authenticated: false };

// Device-token only (record 056 Q6). Every refusal is the same shape —
// there is nothing to distinguish once ctx.kind isn't "device".
export const handler: Handler<void, MeResult> = async ({ ctx }) => {
  const deviceCtxValue = deviceCtx(ctx);
  if (!deviceCtxValue) return { authenticated: false };
  const { tenantId, deviceId, storeId, code, name } = deviceCtxValue.device;

  const store = await withTenantScope(ctx.db, tenantId, (scopedDb) => getStore(scopedDb, storeId));
  if (!store) return { authenticated: false };

  return { authenticated: true, deviceId, name, code, storeId, storeName: store.name };
};
