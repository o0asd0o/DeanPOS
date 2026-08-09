import type { DatabaseInstance } from "../../../db/client.ts";
import { executeWithOffsetPagination, type PageEnvelope } from "../../../common/pagination.ts";
import type { Modifier } from "../../../db/prisma/generated/types.ts";
import type { Selectable } from "kysely";

export const listModifiersForGroup = (db: DatabaseInstance, groupId: string) =>
  db
    .selectFrom("Modifier")
    .selectAll()
    .where("group_id", "=", groupId)
    .orderBy("sort_order")
    .orderBy("id")
    .execute();

export const listModifiersForGroupPage = async (
  db: DatabaseInstance,
  groupId: string,
  page: number,
  perPage: number,
): Promise<PageEnvelope<Selectable<Modifier>>> => {
  const qb = db
    .selectFrom("Modifier")
    .selectAll()
    .where("group_id", "=", groupId)
    .orderBy("sort_order")
    .orderBy("id");
  return executeWithOffsetPagination(qb, { page, perPage });
};

export const listActiveModifiersForGroup = (db: DatabaseInstance, groupId: string) =>
  db
    .selectFrom("Modifier")
    .selectAll()
    .where("group_id", "=", groupId)
    .where("archived_at", "is", null)
    .orderBy("sort_order")
    .orderBy("id")
    .execute();
