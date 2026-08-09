import { availabilityListInputSchema } from "contract/src/contract.ts";
import type { z } from "zod";
import { hasAtLeastRole, canAccessStore } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { getStore } from "../../store/db-operations/queries/get-store.query.ts";
import {
  listAvailability,
  type AvailabilityListInput,
  type AvailabilityListOutput,
} from "../db-operations/queries/list-availability.query.ts";

type Input = z.infer<typeof availabilityListInputSchema>;
export const handler: Handler<Input, AvailabilityListOutput> = async ({
  ctx,
  input,
}) => {
  const empty = {
    items: [],
    count: 0,
    page: 1,
    perPage: input.perPage ?? 10,
    hasNextPage: false,
    hasPrevPage: false,
    unavailableInScope: [],
  };
  if (
    ctx.kind !== "tenant" ||
    !ctx.principal.userId ||
    !ctx.principal.role ||
    !hasAtLeastRole(ctx.principal.role, "admin")
  )
    return empty;
  const { tenantId, userId, role } = ctx.principal;
  return withTenantScope(ctx.db, tenantId, async (db) => {
    if (
      !(await getStore(db, input.storeId)) ||
      !(await canAccessStore(db, userId, role, input.storeId))
    )
      return empty;
    const page = input.page ?? 1;
    const perPage = input.perPage ?? 10;
    return listAvailability(db, {
      storeId: input.storeId,
      page,
      perPage,
      search: input.search,
      sort: input.sort as AvailabilityListInput["sort"],
    });
  });
};
