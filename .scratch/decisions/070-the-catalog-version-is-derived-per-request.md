# 070: The catalog version is derived on every request, and the cheap check is a second procedure over the same expression

- **Status:** decided
- **Stakes:** high — a new procedure in the contract with `offline-sync`, and the failure mode is a terminal that sells yesterday's prices
- **Date:** 2026-08-04
- **Asked by:** the human, via `.scratch/catalog/PRD.md` scenarios 11 and 22; sub-question 2 of the same brief that produced [069](069-the-catalog-version-is-a-sha256-of-the-payload-per-store.md)
- **Relates to:** **[069](069-the-catalog-version-is-a-sha256-of-the-payload-per-store.md) — what the version is**; [062](062-the-wrong-tenant-probe-coverage-guard.md); [067](067-the-availability-screen-stages-toggles-and-saves-once.md) §3

**Split from 069**, which ran to 346 lines against a 300-line cap. 069 decides *what the
version is* — the hash input, the wire shape, the display. This decides *where it is
computed and what the cheap check costs*. **They are genuinely separable: everything here can
be reversed without changing a byte of 069**, because the version's shape on the wire is the
same whichever way it is produced. That is also why 069 scores the wire shape as the
expensive half and this record scores itself cheap.

## The question

If the terminal's "has the menu changed?" check costs the same as downloading the menu, the
whole mechanism is pointless. Where is the version produced — freshly on every request, or
kept in a column and updated whenever someone edits the catalog? And what does the terminal
actually call to ask the cheap question?

A wrong answer costs either a 400-Variant download over a phone tether every few minutes, or
a write path that forgets to update the stored value and leaves every terminal selling
yesterday's prices with nothing to notice it.

## What I chose, and why

**Derived on every request. Nothing is stored.** That is the PRD's own instruction, L437–439:
*"Derive it; do not ask a write path to remember to bump it."* No stored value means no write
path can forget, no trigger to review, and no migration to unwind.

**The cheap check is a second procedure over the same expression:**

```
catalog.read({ storeId })    → { version, ...payload }
catalog.version({ storeId }) → { version }
```

- **One `.query.ts` builds the content; both procedures call it.** `catalog.version` selects
  **only the hash column**, so PostgreSQL assembles and hashes the payload but never sends
  it — the payload crosses neither the wire nor the Kysely boundary.
- **N — `catalog.version` must not have a query of its own.** Two expressions drift, and the
  symptom is a terminal that re-fetches forever or never re-fetches at all. **The property to
  assert:** after each kind of catalog write, `catalog.version(s).version` equals
  `catalog.read(s).version`.
- **`catalog.version` is a procedure**, so PRD security criterion 1 applies unchanged and
  **record 062's run-time contract walk will demand a `wrong-tenant probe [catalog.version]`
  test the day it is added**, with no wiring. A version is a fingerprint of a tenant's whole
  menu; leaking whether two tenants' catalogs match is still a leak.

### What it costs, with the numbers

**On the axis that binds — the wire.** `{"version":"<64 hex>"}` is about **80 bytes** against
a 400-Variant payload in the **hundreds of kilobytes** before compression: three orders of
magnitude. *This is an estimate from the payload's field list, not a measurement*, and it is
the only number here that is not read off a document.

**Server-side** it is one assembly of a small query. `offline-sync` fires the check on the
`online` event, on focus, on a timer while entries are pending, and on a manual button — per
terminal — so a Store with a handful of terminals produces single-digit queries per minute.

**The honest concession:** the version-only call does the same database work as a full fetch
and saves only the transfer. That is the right trade while the wire is the constraint, and
the trigger below is what says when it stops being.

**Adjacent, deliberately not decided here:** the payload's own size bound. That is scenario
9's question, and it is not this record's to answer.

### Weights, declared before any option was scored

**User ×2** (a manager on a tether) · **Business ×1** (bandwidth and support load — real,
bounded, and not revenue) · **Eng cost/risk ×2** (this is the one question where the options
genuinely differ: an expression versus a migration) · **Reversibility ×3** · **Evidence ×2**.
Max 50. **Not changed after scoring.**

## The options, ranked

| Rank | Option | User ×2 | Bus ×1 | Eng ×2 | Revers ×3 | Evid ×2 | Total |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **Derived per request; `catalog.version` selects only the hash column** | 5 (10) | 4 | 5 (10) | 5 (15) | 5 (10) | **49** |
| 2 | Derived per request, plus a short-TTL in-process memo, now | 5 (10) | 4 | 3 (6) | 5 (15) | 2 (4) | **39** |
| 3 | No version-only procedure; `catalog.read` is the only path | 1 (2) | 1 | 5 (10) | 5 (15) | 1 (2) | **30** |
| 4 | A stored `catalog_version` row per (tenant, store), maintained on write | 5 (10) | 4 | 2 (4) | 2 (6) | 3 (6) | **30** |
| 5 | Defer to the implementer | 1 (2) | 1 | 3 (6) | 5 (15) | 1 (2) | **26** |

**Ranks 3 and 4 tie at 30 and the tie breaks toward reversibility**, as the process requires:
option 3 is a deletion, option 4 is a merged migration.

**1. Chosen.** It adds one procedure and no state. The PRD instructs the derivation in as
many words, the reversal is a deletion, and it is the only option where "the version can be
wrong" has no mechanism to be wrong through. Eng 5 because it reuses the expression 069
already decided — there is no second thing to build.

**2. A short-TTL memo now.** Genuinely cheap and genuinely reversible, and it is the
**pre-decided intermediate step** under the trigger below. It loses today on evidence alone:
nothing has been measured, and it buys a saving nobody has shown is needed at the price of a
window — up to the TTL — in which a real change is reported as "unchanged". That window is
nothing against `offline-sync`'s polling interval, which is exactly why it is the right
*next* move and the wrong *first* one.

**3. No version-only procedure at all.** The genuine do-nothing: the terminal fetches the
whole payload and compares locally. It is the cheapest to build and the cheapest to reverse,
and it is what ships if nobody decides this. It fails on the one thing the mechanism exists
for — a 400-Variant download over a tether every few minutes is exactly the cost the hash was
chosen to avoid, and `offline-sync` L222–223 already specifies *"a lightweight version
check"*, so shipping this would contradict the consumer's own PRD.

**4. A stored version row.** The cheapest possible check — one indexed row read — and the
only option that would matter under heavy polling. It loses on three things. The PRD forbids
its premise outright. One tenant-level write (a Discount, three outlets) must recompute every
Store's row. And archiving a Category must recompute rows whose own tables were never
touched, so the exclusion chain arrives as a trigger nobody can review. Reversibility 2
because it is a table and a merged migration. **The named successor**, and cheaper to add
later than to remove later.

**5. Defer.** Included because the process requires it. **15 of its 26 points are
reversibility** — the inflation records 002 onward leave visible. It fails because there is a
default here and the default is option 3.

## How to turn it back

| What | Cost |
| --- | --- |
| **The whole record** | Delete the `catalog.version` contract entry and its handler. `catalog.read` still returns the version, so **`offline-sync` degrades to full fetches rather than breaking** — the reversal is a performance regression, not an outage. One commit. |
| → option 2, the TTL memo | Additive: one memo keyed by `(tenantId, storeId)` in the handler, one TTL constant. It touches nothing in 069 and nothing on the wire. |
| → option 4, the stored row | One migration creating the table, plus a recompute call on every catalog write path, plus the archive-cascade case. **The wire shape does not change, so every terminal's cached version stays valid and no client deploys** — which is the whole reason 069 was split from this record. |
| Count first | **`rg -n 'catalog\.(read\|version)' apps packages \| wc -l` — zero today.** No `catalog` namespace in `packages/contract/src/contract.ts` and no `Variant` model in `schema.prisma`; every number here is measured against zero. |

Formally: superseding record; flip this `Status:` to `overturned` with date and reason;
update the `LOG.md` line. **Record 069 is independent and is not overturned with it.**

## What should make you reverse this

- **The version-only query enters the top five of database time, or its p95 exceeds ~150 ms
  at 400 Variants.** The named trigger, and the successor is option 2 first, option 4 only if
  option 2 is not enough. *150 ms is a tuning knob, not a constant to defend* — it is roughly
  where a background check starts competing with foreground work, and the right way to set it
  is to watch a real one.
- **`catalog.version` and `catalog.read` return different strings for the same Store.** The
  `N` above has been broken — someone gave the version its own query. Fix the query, not the
  assertion.
- **An implementer proposes a trigger or a materialised view to keep a version fresh.** That
  is option 4 arriving without its record. It may well be right by then; it needs the
  migration counted first.
- **`offline-sync` starts calling `catalog.read` where it means `catalog.version`.** The
  cheap path exists and is not being used, which is the same cost as option 3 with extra
  code.
- **A `wrong-tenant probe [catalog.version]` test does not exist when the procedure lands.**
  062's guard should make this impossible; if it does not fire, the guard has a gap and that
  is the more urgent finding.

## Evidence

**Repository, read 2026-08-04, main checkout:**

- `.scratch/catalog/PRD.md` — **L437–439, the instruction this record follows:** *"The
  version is the contract with `offline-sync`. If it can fail to move after a write, a
  terminal will sell yesterday's prices indefinitely and nobody will know. Derive it; do not
  ask a write path to remember to bump it."* Also L264–275 (one query procedure returns the
  payload plus a version), L249 (exclusion computed from the parent chain — the case option 4
  must recompute for), security criterion 1, scenario 9.
- `.scratch/offline-sync/PRD.md` — **L222–223, the consumer's own requirement:** *"A
  lightweight version check on the same triggers; the full payload is fetched only when the
  version differs."* L41 (refresh by comparing versions). **Sync triggers, L219–221:** the
  `online` event, focus, a periodic timer while entries are pending, and a manual button —
  the four call sites the cost estimate is built from.
- `docs/adr/0008-backend-module-structure.md` — commands and queries in separate directories,
  *"not by separate models or stores"*, so both procedures reading one `.query.ts` is the
  shape the ADR already describes rather than a new pattern.
- `062` — the guard *"imports the contract and walks it at run time"* using
  `isContractProcedure`, so *"a procedure added tomorrow appears with no wiring"*. That is
  what makes the probe obligation above automatic rather than a note.
- `067` §3 — the availability save's response *"returns the new catalog version"*, which is
  `catalog.read`'s version by another path and is unaffected by this record.
- `packages/contract/src/contract.ts` — **no `catalog` namespace**; `schema.prisma` — no
  `Variant`, `MenuItem` or `Category` model. Every reversal count is measured against zero.

**Searched for and not found, where the absence mattered:**

- **No caching layer, memo, TTL helper, or materialised view exists anywhere in
  `packages/backend`** — grepped for `cache`, `memo`, `ttl`, `MATERIALIZED`. Option 2 would
  be the first of its kind in this codebase, which is part of why its evidence scored 2.
- **No performance budget, response-size limit or query-time bound is stated in
  `.scratch/foundation/PRD.md` or any ADR** — grepped for all three. There is no existing
  number to hold this to, which is why the ~150 ms trigger is named as a knob rather than
  presented as a standard.
- **Records 001–069 searched for read-model caching, version derivation or query-cost
  decisions: none names any.** `070` was the next free filename. No duplicate.

**External:** none needed. Every fact this record turns on is in the two PRDs and the
contract. **Nothing authoritative was sought or found outside the repository**, and saying so
is more useful than padding this section with adjacent links.
