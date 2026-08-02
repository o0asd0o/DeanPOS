# 12 — The Override mechanism and its as-of-time re-verification

**Status:** ready-for-agent

## What to build

A manager standing at the counter enters their PIN on the cashier's terminal and authorises an
action the cashier may not perform alone. The approval is recorded against that action, with a
name and a reason, and it authorises **exactly one** action — an approval cannot be reused for
a second void. It works offline, because a manager standing at the counter during an outage is
exactly when Overrides are needed.

The set of actions requiring an Override is fixed by ADR-0005: void a paid Order, refund
(whole or line), manual line price override, and closing a DrawerSession with a Variance
beyond threshold. **This issue builds the mechanism; `checkout` and `drawer-sessions` attach it
to their actions.** Nothing consumes an Override yet, and that is expected.

**Online**, the server verifies the manager's PIN and role. **Offline**, the terminal verifies
against the locally synced PIN hash (issue 10) and records the Override alongside the action.
Everything the terminal asserts while offline is a claim, not a fact.

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
      reason, the timestamp, the Device, the Store, and the id of the record it authorised.
      An `UPDATE` against it is prevented.
- [ ] A manager authorises by entering their PIN on the cashier's terminal, without signing in
      separately, and supplies a reason.
- [ ] An Override is bound to one action instance and is **consumed** by it; a second attempt
      to use the same Override fails.
- [ ] Online, the server verifies the PIN and the `manager`-or-above role. A `cashier`'s PIN
      does not authorise.
- [ ] Offline, the terminal verifies against the locally synced hash and records the Override.
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

## Comments

_Sliced from `.scratch/tenancy-identity/PRD.md` (stories 37–43), ADR-0005, ADR-0007, Security
criteria 11 and 12. Merged from the originally-drafted mechanism and re-verification slices._

_**Obligation carried forward to `offline-sync`:** it owns the replay endpoint and must call
the re-verification procedure this issue exposes, quarantining the Order when it fails._
