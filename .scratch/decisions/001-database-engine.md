# 001: The project stores data in PostgreSQL

- **Status:** decided
- **Stakes:** high
- **Date:** 2026-07-31
- **Asked by:** human (recorded by `orc2 init` at pipeline setup)

## The question

Which database the project's code and tests write to, and therefore what every
lane has to isolate before it can run tests in parallel.

## What I chose, and why

PostgreSQL. This was chosen by the human at setup rather than by the
`decider`, so this record exists to make the choice **visible and reversible**
rather than to argue it. It is here so that no agent re-litigates the engine
mid-issue, and so that any issue assuming a different one is caught as a
contradiction instead of being quietly reconciled by whoever noticed first.

What this commits the project to: a running server in every environment that runs tests, `createdb`/`dropdb` around every lane, and real write concurrency — so a concurrency test that passes here is evidence, not an artefact of the engine. The development database is `DeanPOS_dev` and is never dropped or reset by an agent; lane databases are named `DeanPOS_lane_*` and that prefix is the only thing the drop guard will act on.

## The options, ranked

Not ranked — this was a human's setup decision, not a decider ranking. If it
is reopened, the replacement record must score the incumbent as one of its
options, with its **true switching cost as of then**, not the cost it would
have had at setup.

## How to turn it back

Concrete, and honest about what it costs today:

1. Write a superseding record naming the new engine, and flip this record's
   `Status:` to `overturned` with the date and reason.
2. Change `ORC2_DB` (and `ORC2_DEV_DB`, `ORC2_LANE_PREFIX`) in `.orc2/config.env`
   and run `orc2 render` — the lane-isolation procedure in the orchestrator is
   engine-specific and regenerates from that value.
3. Repoint `DATABASE_URI` in `.env` and in every lane `.env`.
4. Rewrite the migrations for the new engine's dialect. **This is the part that
   is not cheap**, and it grows with every migration merged after this record
   was written. Count them before promising a reversal.
5. Re-run the full gate, and re-apply migrations to the development database.

The cost of steps 1–3 is roughly constant. The cost of step 4 is the real
number, and it is the one to re-state at the next human checkpoint if anything
was built on top of this.

## Evidence

The human's setup answer to `orc2 init`. No research was performed, and this
record does not claim any — see **What I chose, and why**.
