import { implement } from "@orpc/server";
import type { Ctx } from "backend/src/common/ctx.ts";
import { handler as createStoreHandler } from "backend/src/store/handlers/create-store.ts";
import { handler as deactivateStoreHandler } from "backend/src/store/handlers/deactivate-store.ts";
import { handler as getStoreHandler } from "backend/src/store/handlers/get-store.ts";
import { handler as listStoresHandler } from "backend/src/store/handlers/list-stores.ts";
import { handler as reactivateStoreHandler } from "backend/src/store/handlers/reactivate-store.ts";
import { handler as updateStoreHandler } from "backend/src/store/handlers/update-store.ts";
import { contract } from "contract/src/index.ts";

// Only transport-aware code for `store.*` (ADR-0008 rule 5).
const os = implement(contract).$context<Ctx>();

export const storeGetRoute = os.store.get.handler(({ context, input }) =>
  getStoreHandler({ ctx: context, input }),
);
export const storeListRoute = os.store.list.handler(({ context }) =>
  listStoresHandler({ ctx: context, input: undefined }),
);
export const storeCreateRoute = os.store.create.handler(({ context, input }) =>
  createStoreHandler({ ctx: context, input }),
);
export const storeUpdateRoute = os.store.update.handler(({ context, input }) =>
  updateStoreHandler({ ctx: context, input }),
);
export const storeDeactivateRoute = os.store.deactivate.handler(({ context, input }) =>
  deactivateStoreHandler({ ctx: context, input }),
);
export const storeReactivateRoute = os.store.reactivate.handler(({ context, input }) =>
  reactivateStoreHandler({ ctx: context, input }),
);
