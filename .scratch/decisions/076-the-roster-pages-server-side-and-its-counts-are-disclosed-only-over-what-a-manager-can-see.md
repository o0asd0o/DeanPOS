# 076: The roster pages server-side, and its counts are disclosed only over what a manager can see

- **Status:** decided
- **Stakes:** high (a screen a manager sees, and the count-leak clause of 044 §2)
- **Date:** 2026-08-07
- **Asked by:** human — "make the search pagination be on the server side?"

## The question

The Employees roster (`user.list`) shipped as a whole-array read with client-side filtering and paging (record 044 §2). Devices already pages server-side (record 056 Q5). Should `user.list` follow — and what happens to 044's "no count, total or 'N more'" clause, which the pagination envelope necessarily touches?

## What was decided, and why

**Yes — `user.list` becomes a server-paged, server-filtered envelope, and the envelope's numbers are computed over only the rows the caller can see.**

- Input: `{ page, perPage, role, storeId, search, sort }` — role, store and search filter in the DB, so a page is a page of the *filtered* set. The id tie-break keeps offset pages stable.
- Output: the device.list envelope — `{ items, count, page, perPage, hasNextPage, hasPrevPage, totalCount, activeCount }`.
- **044 §2's "no count, total" clause is amended, not abandoned.** Its purpose was that "a leaked count tells a manager how many colleagues they are not allowed to see." Every disclosed number — `count`, `totalCount`, `activeCount` — now counts only rows the manager can see (the same visibility predicate as the rows). The other two 044 clauses are untouched: the caller is always in their own result, and the Stores cell is still projected server-side through the caller's own visibility.
- **The manager's filters stay inside their visibility.** A manager filtering or searching a Store they cannot see matches nothing — the store filter requires the store to be one of the caller's own, and the store-name search is scoped to the caller's visible Stores. A manager searching "Malabon" (a Store the Stores screen hides from them, record 038 §6) learns nothing and finds nothing.
- **The assignment history is resolved in SQL, not per-user JS.** One CTE (`DISTINCT ON` per user/store, ordered by `effective_from` then `created_at`, as of one captured `now`) expresses exactly what `getAssignedStoreIdsAsOf` does in JS, including the un-assign-writes-a-closing-row rule (issue 04). The page's own assignment sets are one batched read.
- **`perPage` caps at 1000, not 100.** The Devices assignee picker (issue 17) reads the whole roster through this procedure to name a device's assignee; the roster is small and 1000 is its ceiling. The screen itself pages at 10.
- **Refused callers get an empty envelope, never an error** — the shape the contract promises, leaking nothing, matching device.list's handling of non-admins.

## What this changes from 044

- 044 §2 "no count, total or 'N more'" → the envelope carries `count`/`totalCount`/`activeCount`, computed over the caller-visible set.
- The manager-visibility and Stores-projection logic moves from a post-query JS loop over every Tenant User into the SQL's WHERE and a batched per-page read.

## How to turn it back

Restore `user.list`'s `z.void()` input and array output, and the handler's per-User JS loop. The screen's filters would need to move back into `UserListCard`'s client-side filter. No migration is involved; this is contract and query code only.
