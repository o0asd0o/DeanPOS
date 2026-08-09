import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import {
  listMenuItems,
  type MenuItemListInput,
  type MenuItemListOutput,
} from "../db-operations/queries/list-menu-items.query.ts";
import { toMenuItemOutput } from "../helpers.ts";

type MenuItemOutput = ReturnType<typeof toMenuItemOutput>;

type ListOutput = Omit<MenuItemListOutput, "items"> & { items: MenuItemOutput[] };

const emptyPage = (input: MenuItemListInput): ListOutput => ({
  items: [],
  count: 0,
  page: input.page ?? 1,
  perPage: input.perPage ?? 10,
  hasNextPage: false,
  hasPrevPage: false,
  totalCount: 0,
  activeCount: 0,
  liveCount: 0,
});

export const handler: Handler<MenuItemListInput, ListOutput> = async ({ ctx, input }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.role) return emptyPage(input);
  const { tenantId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "manager")) return emptyPage(input);

  return withTenantScope(ctx.db, tenantId, async (db) => {
    const result = await listMenuItems(db, input);
    return { ...result, items: result.items.map((row) => toMenuItemOutput(row)) };
  });
};
