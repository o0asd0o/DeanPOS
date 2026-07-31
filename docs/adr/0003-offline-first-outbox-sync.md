# ADR-0003: Offline sales via a local outbox and idempotent replay

- **Status:** accepted
- **Date:** 2026-07-31
- **Decided by:** human, in the app-wide planning session

## Context

The cashier terminal must **complete sales while the network or server is down** and
reconcile later. This is the single most expensive requirement in the plan, and the
one most likely to be got wrong quietly.

PowerSync, ElectricSQL, and RxDB were considered and rejected: each puts a third party
or a replication protocol in the critical money path for an MVP whose write pattern is
append-only and tenant-scoped.

## Decision

Hand-rolled, in the terminal:

1. The Device holds a local **catalog cache** and an **Outbox** in IndexedDB.
2. Each Order is stamped on the Device with a **client-generated UUID** and the
   Device's own timestamp at the moment of payment.
3. On reconnect, the Outbox **replays** to the API. Replay is **idempotent on the
   Order UUID** — sending the same Order twice is a no-op, not a duplicate sale.
4. The server stores the **recorded price** — what the customer actually paid —
   verbatim. It never re-prices a replayed Order against the current catalog.

## Consequences

- A terminal with a stale catalog sells at yesterday's price until it reconnects.
  **That is correct behaviour, not a bug**, and it is a reporting note.
- Device clock skew is real and unfixable from the server. Sales carry both the Device
  timestamp and the server receipt timestamp; reports must state which one they use.
- The Outbox must survive a browser reload, a tab close, and a device reboot.
  A test that only exercises a live connection tests nothing here.
- DrawerSession close cannot depend on the server having every Order — a DrawerSession closed offline
  reconciles against what the Device knows.
- Offline PIN unlock requires PIN hashes to be synced to the Device. That is a
  deliberate credential-at-rest tradeoff; see ADR-0007.

## Reversing it

Cheap to abandon (drop the Outbox, require connectivity) and moderately expensive to
replace with a managed sync engine, since the idempotent-replay contract is already
what such an engine would provide.
