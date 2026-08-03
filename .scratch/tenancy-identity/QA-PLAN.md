# QA plan — tenancy-identity

This PRD stages its QA. It overrides `.orc2/ORCHESTRATOR.md`'s "when every issue under a PRD
is closed" trigger and its round cap of 2, per that section's staged-QA hook.

**Why staged.** Thirteen issues, and the first four decide whether isolation and identity are
correct at all. A single QA at the end would find a spine defect after nine slices were built
on it. Each checkpoint runs at the seam that produced the work it judges.

> ## ALL CHECKPOINTS DEFERRED — 2026-08-03
>
> **The human directed the run to continue to issue 13 without executing any QA checkpoint.**
> A, B, C and D are **not run and not passed**. No verdict is recorded against any of them,
> because none was earned. Nothing in this file may be read as a PASS.
>
> **What this costs, stated plainly.** Every issue in this PRD ships verified by the gate and by
> two second-model review rounds — which proves the code does what its tests say, and proves
> nothing about whether the area works. The specific gaps are named under checkpoint A below and
> they now extend across all thirteen issues: the `happy-dom` cookie blind spot that has already
> hidden one real bug, session lifetime end to end, the `Origin` gate, PIN unlock against a real
> Device token, lockout surviving a reload with no network, and every wrong-tenant probe proven
> to hide a row that is *there* rather than merely absent.
>
> **Running QA later does not become cheaper.** The staged design exists so a spine defect is
> caught at the seam that produced it; deferring collapses all four checkpoints into one run
> against thirteen issues, which is the shape this plan was written to avoid.
>
> To resume: run A first — it gates the rest — then B, C, D in order, each at its stated cap
> of 1.

## The rule every checkpoint follows

**One round, then the human.** QA runs. On FAIL, spawn `fixer` once with its findings, re-run
the gate, return to **the same** QA agent. If that second verdict is not PASS, **stop and
escalate** — do not attempt a second fix, and do not record a PASS.

This is a cap of **1**, not the orchestrator's 2. It is deliberate: in this area a finding
that survives one fix is usually a design question, and a second mechanical fix round buries
it.

On PASS, record the verdict against the checkpoint below and **continue unattended to the
next group.** Checkpoints A, B, and C are quality gates, not human stops; the human stop is
checkpoint D, which is the PRD checkpoint the orchestrator already designs for.

**Needs-human-eyes items accumulate.** They are never sent to the fixer and never
auto-accepted. Carry them forward and present the whole list at checkpoint D — or at whichever
checkpoint the run stops on, if it stops earlier.

**Reference capture happens once**, before checkpoint A, covering every mock this PRD names.
Do not re-capture per checkpoint; the rate limit is real and a partial capture reported as
fidelity is worse than no capture.

## Checkpoint A — the isolation and identity spine

- **Runs after:** issue 04 merges
- **Covers:** 01, 02, 03, 04
- **Scope:** full — happy path **and** negatives. The negatives are the deliverable here.
- **Screens:** `backoffice/login-1440`

What it must exercise: a Tenant provisioned and its admin signing in; the session persisting
across a browser restart and dying on sign-out; idle and absolute expiry; the `Origin` gate
refusing a foreign origin, the `pos.` origin, and a missing header; role and Store-membership
gating including the admin exemption; and the wrong-tenant probe answering empty for every
procedure that exists by then.

**If checkpoint A does not pass in one round, the run stops here.** Nothing downstream is
worth building on an unproven spine.

> **DEFERRED 2026-08-03 — not run, and not passed.** The human directed the run to continue to
> issue 05 without executing this checkpoint. **No verdict was recorded, because none was earned**
> — do not read this section as a PASS, and do not let a later checkpoint's PASS be taken as
> covering 01–04.
>
> What is therefore unverified: sign-in **in a real browser** — the `happy-dom` cookie blind spot
> is the one thing only QA closes, and it has already hidden a real bug once; session persistence
> across a browser restart; idle and absolute expiry end to end; the `Origin` gate against a
> foreign origin, the `pos.` origin, and a missing header; the admin exemption and Store-membership
> gating exercised rather than unit-tested; and the wrong-tenant probes proven to hide a row that
> is *there* rather than merely absent.
>
> Everything above was covered by the gate and by two second-model review rounds per issue. That is
> not the same as being exercised, which is the whole reason this checkpoint exists.
>
> **Checkpoint B now covers 01–08, not 05–08**, unless A is run first.

## Checkpoint B — the back-office

- **Runs after:** issue 08 merges
- **Covers:** 05, 06, 07, 08
- **Scope:** full — happy path and negatives.
- **Screens:** `backoffice/users-1440`, `backoffice/settings-sales-1440`

What it must exercise: Store create/edit/deactivate scoped to one Tenant; User create, assign,
promote, reset, deactivate — with sessions dying immediately and history surviving; settings at
their defaults on a fresh Tenant and admin-only on change, each change audited with both values;
`cash` undeletable and unduplicable by the database; per-Store method availability enforced
server-side.

## Checkpoint C — the terminal

- **Runs after:** issue 12 merges
- **Covers:** 09, 10, 11, 12
- **Scope:** full — happy path and negatives.
- **Screens:** `backoffice/devices-1440`, `pos/device-enrolment-1280`, `pos/pin-unlock-1280`,
  `pos/pin-unlock-390`, `pos/manager-override-1280`

What it must exercise: enrolment consuming its code once; a revoked Device refused on every
procedure; PIN unlock refused without a valid Device token; the sync payload carrying exactly
one Store's active PIN hashes and no password hash; lockout surviving a reload with no network;
an Override bound to one action and consumed by it; and re-verification answering against the
role and membership in force at the stated time, both directions.

## Checkpoint D — whole PRD, happy path only

- **Runs after:** issue 13 merges
- **Covers:** the whole PRD
- **Scope:** **happy path only.** Negatives were judged at A, B, and C; this checkpoint asks
  one question — does the area work end to end for someone using it correctly?
- **Screens:** every mock this PRD names

The single path: provision a Tenant → the admin signs in → creates a Store → configures its
settings and payment methods → creates a cashier and a manager and assigns them → enrols a
terminal at that Store → the cashier sets a PIN and unlocks → a manager approves an Override
with their PIN → the admin reviews it in the back-office.

**This is the human checkpoint.** On PASS, record it at the top of the PRD, present every
decision record made during the run — high-stakes first — plus the accumulated
needs-human-eyes list, and stop. Do not start `catalog`.

## Notification

One message at the end of the run, as the orchestrator specifies — not one per checkpoint.
It names which checkpoint the run reached and in which of the three states it ended.
