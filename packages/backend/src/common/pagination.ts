import { sql } from "kysely";
import type { SelectQueryBuilder } from "kysely";

export type PageEnvelope<O> = {
  items: O[];
  count: number;
  page: number;
  perPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

// Offset pagination with the limit+1 next-page probe (the shape ApxDenta's
// domain server uses — fetch one extra row, then trim it, so hasNextPage
// needs no second query). Count runs first so the page is clamped to one
// that exists; the caller's filters and ordering must be on `qb` already.
export async function executeWithOffsetPagination<O, DB, TB extends keyof DB>(
  qb: SelectQueryBuilder<DB, TB, O>,
  { page, perPage }: { page: number; perPage: number },
): Promise<PageEnvelope<O>> {
  // clearSelect() leaves the builder's selection generic as the alias node,
  // not the unwrapped column, so the row is typed explicitly here.
  const countRow = (await qb
    .clearSelect()
    .clearOrderBy()
    .select(sql<number>`count(*)::int`.as("count"))
    .executeTakeFirstOrThrow()) as unknown as { count: number };

  const { count } = countRow;

  const pageCount = Math.max(1, Math.ceil(count / perPage));
  const clampedPage = Math.min(page, pageCount);
  const rows = await qb
    .limit(perPage + 1)
    .offset((clampedPage - 1) * perPage)
    .execute();
  const hasNextPage = rows.length > perPage;
  if (rows.length > perPage) rows.pop();

  return {
    items: rows,
    count,
    page: clampedPage,
    perPage,
    hasNextPage,
    hasPrevPage: clampedPage > 1,
  };
}
