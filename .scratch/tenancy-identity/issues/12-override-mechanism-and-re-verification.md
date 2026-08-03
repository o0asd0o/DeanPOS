# 12 — The Override mechanism and its as-of-time re-verification

**Status:** ready-for-agent

## What to build

A manager standing at the counter enters their PIN on the cashier's terminal and authorises an
action the cashier may not perform alone. The approval is recorded against that action, with a
name and a reason, and it authorises **exactly one** action — an approval cannot be reused for
a second void.

**The PIN check works offline** — it runs against the locally synced hash with no network at
all, because a manager standing at the counter during an outage is exactly when Overrides are
needed. **Carrying that approval through the outage is `offline-sync`'s**
([record 061](../../decisions/061-the-offline-override-is-carried-by-offline-sync-not-staged-here.md)):
the approval rides inside the Outbox payload of the action it authorised and is inserted at
replay. This issue builds no local staging — until `checkout` and `drawer-sessions` land there
is no offline action to stage one against.

The set of actions requiring an Override is fixed by ADR-0005: void a paid Order, refund
(whole or line), manual line price override, and closing a DrawerSession with a Variance
beyond threshold. **This issue builds the mechanism; `checkout` and `drawer-sessions` attach it
to their actions.** Nothing consumes an Override yet, and that is expected.

**The PIN is verified on the terminal, online and offline alike**, against the locally synced
hash (issue 10) — one path, so the online case is never the untested one. The server verifies
the *approver*, never the PIN: it independently refuses to record an Override whose named
approver was not `manager`-or-above and a member of that Store at the stated time. Everything
the terminal asserts while offline is a claim, not a fact.

_Amended 2026-08-04: this paragraph said the server verifies the PIN online, which
[record 058](../../decisions/058-pin-management-is-a-back-office-action.md) forbids and a grep test
enforces. [Record 060](../../decisions/060-the-override-is-verified-on-the-terminal-and-consumed-by-a-second-insert-only-table.md)
upheld 058 and amended this issue instead._

**So the second half of this issue is the re-verification procedure**, which `offline-sync`
will call on replay: given an Override and its stated time, was that User a `manager` and a
member of that Store **at that time**? It reads the effective-dated history from issue 04, not
today's values — a manager demoted on Tuesday must not retroactively invalidate a legitimate
Monday approval, and a cashier promoted on Tuesday must not retroactively validate a Monday
one.

**It is tested here as a procedure, not as a replay.** The replay endpoint is `offline-sync`'s
and does not exist yet; this area depends only on `foundation`. `offline-sync` must call this
procedure and says so in its own spec.

Also here: a tenant admin reviews the Overrides that occurred at their Stores, so a pattern
can be spotted.

## Acceptance criteria

- [ ] The `Override` row is **append-only** and names the approving User, the action type, the
      reason, the timestamp, the Device, and the Store. **The id of the record it authorised
      lives on the `OverrideConsumption` row, not here** (record 060 Q3): an Override does not
      know what it authorised until it is consumed, and `Order` and `DrawerSession` do not yet
      exist. An `UPDATE` against either table is prevented by policy and by grant.
- [ ] A manager authorises by entering their PIN on the cashier's terminal, without signing in
      separately, and supplies a reason.
- [ ] An Override is bound to one action instance and is **consumed** by it; a second attempt
      to use the same Override fails.
- [ ] The PIN is verified **on the terminal**, against the locally synced hash, on **both** the
      online and the offline path — one path, exercised on every Override
      ([record 057](../../decisions/057-pin-unlock-verifies-locally-with-pbkdf2.md) Q1,
      [058](../../decisions/058-pin-management-is-a-back-office-action.md),
      [060](../../decisions/060-the-override-is-verified-on-the-terminal-and-consumed-by-a-second-insert-only-table.md)).
      **No server procedure compares a PIN against a stored hash.** The approver is *chosen by
      id*, not identified by their PIN: only Users the synced roster marks `canApproveOverride`
      are offered, and the server independently refuses to record an Override whose named
      approver was not `manager`-or-above **and** a member of that Store **at the stated time**.
      A `cashier` therefore cannot authorise, whether or not their PIN is correct.
- [ ] Offline, the terminal verifies against the locally synced hash — the same code path as
      online (criterion 4), so no path is offline-only. **Durably carrying the approval through
      an outage is `offline-sync`'s**
      ([record 061](../../decisions/061-the-offline-override-is-carried-by-offline-sync-not-staged-here.md)):
      per that area's PRD an Override is not an Outbox entry kind, it travels inside the payload
      of the action it authorised, and the server inserts the `Override` row at replay after
      `verifyOverrideAsOf` passes. This issue ships no local staging and no second queue. With no
      network, `Approve` fails visibly and records nothing — it never reports success.
- [ ] The cashier sees a clear prompt when an action needs a manager — they know to call one
      rather than guess.
- [ ] The re-verification procedure answers correctly against the effective-dated history:
      a manager demoted **after** the Override still verifies; demoted **before** it does not;
      and the same two cases for Store membership.
- [ ] A tenant admin reviews Overrides at their own Stores; a `manager` sees their assigned
      Stores' only; a `cashier` sees none.
- [ ] Nothing logs the PIN entered for an Override.
- [ ] WCAG 2.2 AA on the Override prompt, asserted by the existing automated accessibility check.
- [ ] Wrong-tenant probes on every procedure this issue exposes.

## Visual reference

- Image · whole-screen · 1280: `design/lofi/pos/manager-override-1280.svg`

**Scope of the reference: the manager PIN entry and the reason capture only.** The action that
triggers the prompt — the void, the refund, the price override — is `checkout`'s, and the
DrawerSession close is `drawer-sessions`'.

## Depends on

- 10 — PIN unlock and the hash-sync payload
- 04 — Roles, Store membership, and the authorisation gate

## Relevant files

- `packages/backend/src/db/prisma/schema.prisma` and `src/db/prisma/migrations/**` — `Override`
- `packages/backend/src/**` — the Override handlers and the re-verification procedure per ADR-0008
- `apps/pos/src/features/**` — the Override prompt
- `apps/backoffice/src/features/**` — the Override review list
- `packages/contract/src/contract.ts`
- `apps/pos/src/components/PinPad.tsx` — extracted verbatim from `features/unlock/`
- `apps/backoffice/src/routes/_shell/reports/discounts-overrides.tsx` — the existing placeholder,
  filled

## Comments

_Sliced from `.scratch/tenancy-identity/PRD.md` (stories 37–43), ADR-0005, ADR-0007, Security
criteria 11 and 12. Merged from the originally-drafted mechanism and re-verification slices._

_**Obligation carried forward to `offline-sync`:** it owns the replay endpoint and must call
the re-verification procedure this issue exposes, quarantining the Order when it fails._

_On replay it calls `verifyOverrideAsOf`; **on failure it writes no `Override` row at all** and
quarantines the Order. It never re-verifies a PIN. It carries the terminal's `approvedAt`
unchanged, and the server bounds it (record 060 Q4)._

_`checkout` and `drawer-sessions` each call `consumeOverride(trx, …)` **inside the transaction
that performs the action** — never as a separate request — and each adds its own composite
`(tenant_id, order_id)` / `(tenant_id, drawer_session_id)` foreign key to `OverrideConsumption`
in the migration that creates its own table, which must therefore carry `@@unique([tenantId, id])`._

_**Obligation carried forward to `offline-sync` (record 061):** the offline path for an Override
is that area's, whole. The approval rides inside the Outbox payload of the action it authorised —
it is not an entry kind and gets no queue of its own. **The terminal mints no `Override` id**; the
server assigns it at replay insert, after `verifyOverrideAsOf`. `terminal.recordOverride` is the
online-only path this issue ships, and reconciling it with that area's "the Outbox is the only
write path" rule is `offline-sync`'s to decide and record._

_**Obligation carried forward to `checkout` and `drawer-sessions` (record 061):** mounting
`OverridePrompt` makes its online-only limitation reachable by a cashier. Either mount it after
`offline-sync` ships, or state in your own issue that Overrides are online-only until then._
