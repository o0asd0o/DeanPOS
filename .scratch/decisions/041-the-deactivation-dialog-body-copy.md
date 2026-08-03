# 041: The deactivation dialog says what deactivation does, and never names the thing it is denying

- **Status:** decided
- **Stakes:** high (a claim a user is shown)
- **Date:** 2026-08-03
- **Asked by:** human — a contradiction inside [038](038-the-store-management-screen.md), found by the implementer and confirmed by the second-model reviewer

## The question

Record 038 says the word "delete" appears nowhere on the Store screen, and gives the reviewer
`rg -in 'delete|permanently'` expecting nothing back — yet the confirmation copy it authored
verbatim contained "deleted". One string in 038 changes; nothing else in it moves.

## What I chose, and why

**The replacement string, verbatim:**

```
This store stops being offered for new work, its past sales stay attributed to it, and Reactivate brings it back
```

The original was wrong for a reason worth stating once: **it reassured by negation.** "nothing is
deleted" answers a fear by naming the thing it denies, which plants the word on screen, and a reader
skimming a confirmation dialog takes away the noun far more reliably than the "nothing is". Saying
what deactivation *does* — the Store leaves circulation, its history stays attached to it, and one
click puts it back — carries the same reassurance without ever raising deletion as a possibility.
That is why this is a copy fix and not a check that needed loosening: the invariant was right, the
sentence was the defect.

The reviewer's ruling is followed exactly — the title, the invariant, the check and the brief all
point one way, and one line pointed the other.

Mechanics, so a fixer can paste without re-reading 038: **one sentence, so no terminal full stop**,
which is 038's own rule (a short single-line message carries none; two or more sentences do). This
diverges from `components/SignOutButton.tsx`'s `You will need to sign in again to come back.` —
that string predates the rule and is not re-decided here. `Reactivate` is capitalised because it
names the row action's visible label, so SC 2.5.3's pairing between copy and control holds.
`store` is lower-case in prose, matching `Add store` and the empty state. No token, class, component
or pairing is touched — record 009's rule is not engaged by a string.

Passes 038's own gate: `rg -in 'delete|permanently'` finds nothing in it, as a substring or a word.

## The options, ranked

| Rank | Option                                                       | User ×3 | Business ×1 | Eng ×1 | Revers ×1 | Evidence ×2 | Total  |
| ---- | ------------------------------------------------------------ | ------- | ----------- | ------ | --------- | ----------- | ------ |
| 1    | **One sentence stating what deactivation does** (chosen)      | 5 (15)  | 5           | 5      | 5         | 4 (8)       | **38** |
| 2    | Keep two sentences, swap "deleted" → "removed"                | 3 (9)   | 5           | 5      | 5         | 3 (6)       | **30** |
| 3    | Drop the reassurance clause, keep the rest                    | 2 (6)   | 4           | 5      | 5         | 3 (6)       | **26** |
| 4    | Loosen the reviewer check, keep the string as authored        | 3 (9)   | 2           | 5      | 5         | 1 (2)       | **23** |

Weights declared before options: **user ×3** (this is copy an owner reads under a confirm prompt
with no support line), **evidence ×2**, everything else ×1 — engineering cost and reversibility are
one string in one file for every option, so they separate nothing and are recorded rather than
weighted. Max 40. Not changed after scoring.

**1. Chosen.** Satisfies the invariant, the check and all three facts the dialog owes the admin,
in one sentence shorter than the original two.

**2. "nothing is removed".** Passes the grep and is the smallest possible diff. It loses because it
keeps the reassurance-by-negation shape, so it fixes the string the check happens to match while
leaving the actual defect in place — and "removed" is the next word a reviewer flags.

**3. Drop the clause.** Tempting: the shortest copy, and the title already says `Deactivate`. It
fails the brief's own requirement that the admin be told history stays intact and attributable,
which is the single question a cautious owner has at this dialog. Silence is not reassurance.

**4. Loosen the check.** Honest to consider, since the original sentence was true. It loses on
evidence: the title, the invariant, the brief and `users-1440.svg`'s note ("Nothing is deleted —
deactivation preserves the audit trail", a *designer's* note, never user-facing copy) all point the
other way, and a check relaxed to admit one string stops catching the case it exists for.

## How to turn it back

One string in one place. Record 038's `Every string, verbatim` table, "Confirm dialog body" row, and
whatever `DialogDescription` in `apps/backoffice/src/features/stores/` renders it in the lane —
`rg -n 'stops being offered' apps/backoffice/src` finds every copy. Nothing is built on top of it:
no test asserts the text, no token, component, contract field or migration is involved, and the
title, buttons, live-region strings and failure copy are untouched. Formally: superseding record,
flip this `Status:`, update both `LOG.md` lines.

**Do not turn it back by re-admitting "delete" or "permanently"** — that is option 4, refused above,
and it takes 038's invariant with it.

## What would make this decision wrong

An owner deactivates a Store and afterwards asks support whether the sales are gone — then the
sentence is not carrying the reassurance the negation was there for, and the successor is
option 3-plus: a second short sentence naming reports explicitly. Copy only; no new record needed
beyond amending 038 again.

## Evidence

- `.scratch/decisions/038-the-store-management-screen.md`, read in full 2026-08-03 — the invariant
  and reviewer check at the end of `Every string, verbatim`; the same section's full-stop rule;
  §4's `Dialog` structure and `Reactivate`-is-not-confirmed decision, all unchanged by this record.
- `apps/backoffice/src/components/SignOutButton.tsx:43` — the only shipped `DialogDescription`,
  quoted above as the divergence, not as the precedent.
- **Searched and not found:** `rg 'nothing is deleted|Past sales stay'` over `apps/` returns
  nothing — the string is not on `main`, only in 038 and the open lane, which is why reversal is
  one string and not a shipped-copy migration. No external source consulted: this is a wording
  question inside a settled invariant, and there was nothing authoritative to fetch.
