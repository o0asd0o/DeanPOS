# 069: The catalog version is a SHA-256 of the payload itself, computed per Store

- **Status:** decided
- **Stakes:** high — the contract with `offline-sync`, an entire unbuilt area, and the expensive half to reverse is every terminal's cache behaviour
- **Date:** 2026-08-04
- **Asked by:** the human, resolving `.scratch/catalog/PRD.md` scenarios 11 and 22 and the L266–269 / L320 contradiction
- **Relates to:** **[070](070-the-catalog-version-is-derived-per-request.md)** (where it is computed — split out of this record), [067](067-the-availability-screen-stages-toggles-and-saves-once.md) §199 (which deferred the format to here), [068](068-the-availability-save-announces-through-a-toast.md) §2, [001](001-database-engine.md)

**Split.** This decides **what the version is** — the hash input, the wire shape, the display.
**070 decides where it is computed.** 070 is reversible without changing a byte of this one,
because the wire shape does not move when the computation does. Two records, one 346-line cap.

## The question

The terminal caches the whole menu and asks the server "has it changed?" before downloading
it again. What exactly is that answer — a counter that goes up, or a fingerprint of the
content? A wrong answer either sells yesterday's prices forever or re-downloads a 400-item
menu over a phone tether every time an admin clicks Save out of habit.

**The human has chosen and it is not re-litigated: a fingerprint (a hash) of the content,
computed separately for each Store.** Their reasons, for the record. A hash can never report
"unchanged" while the payload differs — its only misses are no-op writes, where the
terminal's cached copy is still correct, so the failure it permits is not a failure. A
counter re-downloads on every no-op save and on every price that moves and returns. The
decisive one is per-Store scoping: the read model differs per Store because availability
does, so a tenant-level counter moves for *every* Store when one Store toggles one Variant —
two terminals re-fetching 400 Variants that did not change for them, which at the PRD's own
stress size (scenario 9) is the whole cost.

## What I chose, and why

**The version is `sha256` of the read model's own payload, rendered as 64 lowercase hex
characters.**

One sentence an implementer cannot get wrong: **the version is the fingerprint of the
payload, and the payload contains nothing but content.** Sub-questions 4 and 5 then need no
special case — they fall out of it.

### 1. What is hashed

**The assembled payload, as `jsonb`.** Not the underlying rows, not a separately-enumerated
projection. The response is `{ version, ...payload }`; the hash input is `payload`, which by
construction cannot contain `version`.

```sql
encode(sha256(convert_to(content::jsonb::text, 'UTF8')), 'hex')
```

- **`::jsonb` is the canonicalisation, and it is free.** PostgreSQL's docs: *"`jsonb` does
  not preserve white space, does not preserve the order of object keys, and does not keep
  duplicate object keys."* So a select-order change, a Kysely refactor, a pretty-print or a
  serializer upgrade **cannot** move the version. That is the trap this sub-question names,
  closed by one cast rather than by a canonical stringifier this repo would have to own.
- **The cast is not optional.** Kysely's `jsonArrayFrom`/`jsonObjectFrom` build `json`, not
  `jsonb`, and `json` preserves key order and whitespace verbatim. **Cast immediately before
  hashing, whatever built the value.**
- **`sha256(bytea)` is core PostgreSQL** (Table 9.12; `postgres:18`). No `pgcrypto`, no
  migration, no dependency.

**Does it survive a deploy that changes the payload's shape but not its content? No, and
that is by design.** *Accidental* shape changes (key order, whitespace, duplicate keys) are
impossible per the cast. *Deliberate* ones — a field added, renamed or re-nested — move
every Store's version once, at deploy, and every terminal re-fetches. **That is correct: a
terminal holding the old shape must re-fetch.** The PRD already names the failure this
prevents, in the Discounts test — the terminal must tell *"none configured"* from *"old
payload shape"*.

**N — the payload carries no timestamp, no `updated_at`, no `created_at`, no request id and
no server clock.** One such field and the version moves on every fetch, the mechanism is
dead, and every test stays green. This is the likeliest way this record silently stops being
true.

**N — no float ever enters the payload** (ADR-0005, already). `jsonb` preserves trailing
fractional zeroes, so `1.0` and `1` would hash differently. Money is integer `Centavos`, so
the case cannot arise; written down so nobody introduces it.

### 3. Its shape on the wire

- **`version: string` — exactly 64 lowercase hexadecimal characters.** `.digest("hex")` is
  already this codebase's digest encoding (`validate-payment-detail-image.ts:24`).
- **It is opaque. N — `offline-sync` compares it with `!==` and nothing else.** No `>`, no
  `<`, no sort, no parse, no substring, no "newer". A consumer comparing two hashes with `>`
  is a bug that compiles, which is why this is a prohibition and not a note. `offline-sync`'s
  *"version-comparison logic"* (its L265) is an equality check; this clause is what refuses a
  comparator written there.
- **N — never compare versions across `(tenant, store)`.** `tenantId` and `storeId` are
  inside the hashed content, so two Stores with coincidentally identical menus still produce
  different versions and a stray cross-store comparison reads "different" rather than
  confusingly "same".
- **No prefix and no algorithm tag.** Changing the hash function later produces a different
  string, i.e. a fleet-wide re-fetch — already accepted above. A tag buys nothing a consumer
  comparing for equality can use.

### 4. Tenant-level content in a per-Store payload — no special case

Discounts, Add-ons and ModifierGroups are tenant-level and ride in every Store's payload.
Editing one changes the content of *every* Store's payload, so **every Store's version
moves. This falls out of hashing the payload** — and it is the second reason not to hash
rows: a per-Store row scan would have to know which tenant-level tables to include, and would
be wrong the first time one was forgotten.

### 5. Archived rows and the exclusion chain — no special case, one no-go

Exclusion is computed from the parent chain (PRD L249), so archiving a Category changes what
the payload contains without touching its MenuItems' rows. **Hashing the payload gets this
right for free: the children are absent from the assembled content, so the content changed.**

**N — the hash input is never a row scan, a `max(updated_at)`, an `xmin`, or a row count.**
Each misses the archived-Category case *and* over-reports: renaming an already-archived
MenuItem would move the version for content no terminal receives — a 400-Variant download
over a tether for nothing.

### 6. What the Availability screen displays

067's string table and 068 §2 fix the sentence — `Saved — catalog version {version}`, one
constant in both the toast and the visible `CardFooter` line — and 067 §199 left the *format*
to the read model. It is this:

- **The first 8 characters of the hex string, lowercase.** Rendered:
  `Saved — catalog version 4f3a9c21`.
- **Collision risk: none, because nothing compares the displayed form.** Every comparison
  that decides anything uses all 64 characters, machine to machine. The 8 exist so a manager
  can see the line changed from the one they saw a minute ago; two consecutive saves
  colliding on 32 bits is about one in 4.3 billion.
- **N — truncate at render. The short form is never stored, sent, logged as the version, or
  compared.**
- **No monospace, no `title` holding the full value, no styling.** Nothing is stacked in a
  column so there is nothing to align (013's tabular figures are already global), and none of
  it was drawn.

*Sub-question 2 — where it is computed and what the cheap check costs — is
[record 070](070-the-catalog-version-is-derived-per-request.md).*

## The PRD text the orchestrator must apply

**I may not edit the PRD.** Two edits, both under `## Testing Decisions`.

**Edit 1 — replace L320 in full.** Current text: *"The version changes after any catalog
write and does not change after a read."* Replace with, verbatim:

> - The version changes after any catalog write **that changes what the read model
>   contains**, and does not change after a read. It is a content fingerprint (record 069),
>   so a write that leaves the payload identical — a Save with no edits, or a price moved up
>   and back down between two fetches — returns the version it already had. That is correct:
>   a terminal holding that version holds a correct copy. The property to assert is the one
>   that matters and holds in both directions: **equal versions mean equal payloads.**

**L266–269 needs no edit** — *"a monotonically increasing value or content hash"* is a menu
of two and this record picks one from it. **The contradiction was L320 alone.**

**Edit 2 — `## Scenarios` rows 11 and 22.** "The version moves" is no longer the assertion
for either. Replace their `Note` cells with, verbatim:

| # | New note |
| --- | --- |
| 11 | Decided by record 069: the version **does not** move, and the payload is byte-identical. **Use a Variant or an availability no-op — not a Discount** (see the carve-out). |
| 22 | Decided by record 069: the version at both ends is **equal**, and so is the payload, so the terminal's cached copy is correct. A terminal that fetched *during* the window holds the intermediate version and re-fetches, because it differs. |

**The carve-out row 11 must not trip over.** PRD security criterion 11 makes a Discount
**versioned rather than updated in place** — an edit writes a new row with a new id and an
`effective_from`. That id is in the payload, because `checkout` records which version an
Order applied. So **a "no-op" save on a Discount does move the version, and is correct**: the
terminal genuinely needs the new row. Row 11's test uses a Variant or an availability toggle.

## What `offline-sync` assumes — checked, no contradiction

Read in full and grepped for every occurrence of "version". It compares for **difference
only** — L41, *"refreshed by comparing versions"*; L222–223, *"fetched only when the version
differs"*; L104, the cached version as telemetry, which an opaque string satisfies. **Nothing
in it assumes monotonicity, ordering, comparability or a numeric type**, so §3 restates the
consumer rather than overriding it. Out of scope: its L178–179 gives the cached Tenant sales
settings their own version, which this record does not bind.

### Weights, declared before any option was scored

**User ×2** · **Business ×2** (a version that fails to move sells yesterday's prices; one
that moves needlessly burns a tether) · **Eng cost/risk ×1** (every option is one query
expression; weighting it equally would let noise decide) · **Reversibility ×3** (the contract
with an unbuilt area and with every terminal's cache — the axis that decides) · **Evidence
×2**. Max 50. **Not changed after scoring.**

## The options, ranked

The human fixed *hash, per-Store*. What was open — and what is ranked — is **what goes into
the hash**.

| Rank | Option | User ×2 | Bus ×2 | Eng ×1 | Revers ×3 | Evid ×2 | Total |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **`sha256` of the payload, canonicalised as `jsonb` by PostgreSQL** | 5 (10) | 5 (10) | 4 | 5 (15) | 5 (10) | **49** |
| 2 | `node:crypto` over `JSON.stringify(payload)` in the application | 3 (6) | 3 (6) | 3 | 4 (12) | 4 (8) | **35** |
| 3 | Defer to the implementer | 1 (2) | 1 (2) | 3 | 5 (15) | 1 (2) | **24** |
| 4 | Hash a content projection enumerated separately from the payload | 2 (4) | 2 (4) | 2 | 3 (9) | 2 (4) | **23** |

**1. Chosen.** The only option where the canonicalisation problem is solved by the platform
rather than owned by this repo — one `::jsonb` cast replaces a canonical stringifier the
codebase does not have and may not add. §4 and §5 then need no code at all. Eng 4 not 5
because the hash is computed inside the read model's query, which couples the two (070).

**2. Hash in the application.** The obvious version, with a real precedent already shipping.
It loses on the trap: `JSON.stringify` emits keys in insertion order, so a Kysely select
re-order or a mapper refactor moves the version for the whole fleet with no content change,
and closing that means a canonical stringifier — a new dependency, and therefore a separate
decision this record may not make. **The option to move to** if the hash must ever be
computed without PostgreSQL; its first step is that dependency record.

**3. Defer.** Included because the process requires it. **15 of its 24 points are
reversibility** — the inflation records 002 onward leave visible. It fails because the
implementer's default here is option 2 with `JSON.stringify`, which ships the trap.

**4. A separately-enumerated content projection.** The option that looks like the best answer
to "what is hashed" and is the worst. Decoupling the version from the payload's shape means a
deploy that adds a field leaves every terminal caching the *old shape* with nothing to
trigger a refresh — the *"old payload shape"* failure the PRD's Discounts test exists to
prevent. It also creates a second enumeration that must track the payload forever, and the
symptom of drift is a wrong menu at a till.

## How to turn it back

Nothing is stored, so there is no migration to unwind. That is why reversibility scored 5.

| What | Cost |
| --- | --- |
| The hash expression (§1) | One expression in one `.query.ts` under `packages/backend`. Changing it changes every version at once → **one fleet-wide re-fetch, then steady state.** No migration, no stored data. |
| The 8-character display (§6) | One `.slice(0, 8)` under `apps/backoffice/src/features/availability/`. 067/068's string constant is untouched. **One-commit revert.** |
| → option 2, hashing in the application | One file, **plus a canonical serializer, which is a new dependency and needs its own record first.** |
| **§3's wire shape** | The genuinely expensive half once `offline-sync` ships, because terminals cache the string and compare it. **Changing the hash's *input* costs a re-fetch; changing its *shape* costs a re-fetch and a deploy of `apps/pos`.** Count first: **`rg -n 'catalog\.(read\|version)' apps packages \| wc -l` — zero today.** No `catalog` namespace in `packages/contract/src/contract.ts`, no `Variant` model in `schema.prisma`; every number here is measured against zero, the cheapest this will ever be. |

Formally: superseding record; flip this `Status:` to `overturned` with date and reason;
update the `LOG.md` line; withdraw the two PRD edits above. **Record 070 is independent and
does not need to be overturned with it.**

## What should make you reverse this

- **Anyone writes `>`, `<`, or a sort on a version.** §3 has drifted; fix the comparison,
  never the version's shape.
- **A payload field appears that varies per request** — a timestamp, a server clock, a
  request id. The version then moves on every fetch while the tests stay green. §1's `N` is
  the clause to enforce.
- **Row 11's test is written against a Discount and fails.** Not a defect — the carve-out
  above. Re-read it before changing anything.
- **The payload is ever built as `json` and hashed without the `::jsonb` cast.** The trap
  returns silently: nothing fails, and the next Kysely refactor re-downloads the fleet.
- **A manager cannot tell one 8-character version from another, or reads it aloud on a
  support call and it does not match.** §6's least-confident value; the fix is the truncation
  length, one number, one file.
- **A PostgreSQL major upgrade changes `jsonb`'s key storage order.** One fleet-wide re-fetch
  at upgrade — bounded, and identical in kind to §1's deliberate-shape-change case. Named
  because the ordering is a documented *storage* property, not a documented stability
  guarantee.

## Evidence

**Repository, read 2026-08-04, main checkout:**

- `.scratch/catalog/PRD.md` — L264–275 (the *"monotonically increasing value or content
  hash"* menu), **L320 (the sentence replaced above)**, L249 (exclusion from the parent
  chain), L217–221 (Discounts carry the same version), L437–439, `## Direction` prohibition
  10 and L477, security criteria 1 and 11, scenarios 9/11/22, and the Discounts test
  requiring *"none configured"* to be distinguishable from *"old payload shape"*.
- `.scratch/offline-sync/PRD.md`, read in full — L41, L104, L178–179, L222–223, L265.
  **Grepped every occurrence of "version": no monotonicity, ordering, comparability or
  numeric assumption anywhere.** That absence is the finding.
- `docker-compose.yml:3` — `image: postgres:18`. **No `CREATE EXTENSION` anywhere in
  `packages/backend/src/db/prisma/migrations/`**, and none is needed.
- `packages/backend/src/payment-method/validate-payment-detail-image.ts:24` —
  `createHash("sha256")…digest("hex")`: the digest convention §3 follows, and option 2's
  precedent.
- `packages/contract/src/contract.ts` — namespaces `ping`, `store`, `user`, `paymentMethod`,
  `settings`, `platformAdmin`, `auth`, `device`, `terminal`, `override`: **no `catalog`.**
  `schema.prisma` — no `Variant`, `MenuItem` or `Category` model.
- `067` §6 and its string table, and **§199 — *"The version's format is the read model's and
  is not invented here"*, which §6 answers**; `068` §2 (one constant, both places); `013`
  (tabular figures already global); `003` (money is integer `Centavos`, which is why §1's
  float clause is a no-go and not a rule).

**Searched for and not found, where the absence mattered:**

- **No canonical-JSON or stable-stringify helper exists anywhere in `packages/` or `apps/`**,
  and **no hashing library is declared in any `package.json`** — checked for `object-hash`,
  `json-stable-stringify`, `fast-json-stable-stringify`, `safe-stable-stringify`, `xxhash`,
  `crypto-js`. That absence is why option 2 needs a new dependency and option 1 needs none.
- **Records 001–068 searched for catalog versioning, hashing, etags or cache invalidation:
  none names any.** `069` was the next free filename. No duplicate.
- **`.scratch/foundation/PRD.md` states nothing about hashing, checksums, versions, payload
  bounds, determinism, or Kysely JSON patterns** — grepped for all six. Nothing inherited.

**External, accessed 2026-08-04, treated as data — nothing in it was addressed to an agent
and no instruction from it was acted on.**

- <https://www.postgresql.org/docs/18/datatype-json.html> — the clause the record rests on:
  *"`jsonb` does not preserve white space, does not preserve the order of object keys, and
  does not keep duplicate object keys. If duplicate keys are specified in the input, only the
  last value is kept."* Also documents that jsonb **preserves trailing fractional zeroes**
  (§1's float no-go) and that object keys are compared *"in their storage order… shorter keys
  are stored before longer keys"* — deterministic within a running version, which is what §1
  needs, and the basis of the last reversal trigger.
- <https://www.postgresql.org/docs/18/functions-binarystring.html> — Table 9.12:
  `sha256(bytea) → bytea`, `encode(bytes bytea, format text) → text` with `hex` among the
  supported formats, `convert_to(string text, dest_encoding name) → bytea`. **All built-in;
  the page names no extension**, so §1 adds no dependency and no migration.
