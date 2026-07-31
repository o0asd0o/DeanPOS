# ADR-0006: Forward-only expand/contract migrations; rollback is redeploy

- **Status:** accepted
- **Date:** 2026-07-31
- **Decided by:** human, in the app-wide planning session

## Context

A single VPS, one operator, and real sales data. The rollback story has to work at 3am
by someone who did not write the change.

## Decision

- Path to production: `main` → CI gate → container image → VPS. One staging, one prod.
- Migrations are **forward-only**. No down-migrations are written.
- Every schema change is **expand then contract**, in separate releases:
  1. **Expand** — add the new column/table, backfill, write to both. Old code still runs.
  2. **Contract** — a later release removes the old shape, once nothing reads it.
- **Rollback = redeploy the previous image.** It is safe because the previous code still
  runs against the expanded schema. A release that breaks this property is not shippable.

## Consequences

- Destructive DDL in the same release as the code that stops using it is a review
  finding, not a style preference.
- Two-release changes are slower and that is the trade being made.
- Down-migrations, which are written once and tested never, do not exist here.
- Backup posture: nightly `pg_dump` off-box, and a **restore script that has actually
  been run into a scratch database**. An unrehearsed backup is not a backup — the drill
  is a deliverable of the Release & Operations PRD.

## Reversing it

Trivially reversible in mechanism, but reversing it means giving up the guarantee that
the previous image always boots. Nothing is gained by it.
