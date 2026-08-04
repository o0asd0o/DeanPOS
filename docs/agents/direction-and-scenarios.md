# Direction and Scenarios — the two sections that carry taste and recall

> **Not generated.** `orc2 render` writes every other file in this directory from
> `.orc2/config.env`; it does not write this one. Edit it here.

Every other gate in the pipeline checks conformance — does it compile, does it match
the acceptance criteria, does it match the reference. All of them can pass on work
that is correct, complete, and dull, and when they do the pipeline stops, because
"nothing is wrong" is its only exit condition.

These two sections are the ceiling. `## Direction` carries the design intent that an
acceptance criterion cannot express. `## Scenarios` carries the cases nobody thought
of. The `critic` agent writes both; a human edits them; every role downstream reads
them as contract.

---

## `## Direction` — on the PRD

Appended to `.scratch/<prd>/PRD.md`. **Hard cap: one page.** A Direction section that
grows past that stops being read, and an unread contract is worse than none because
everyone assumes it was honoured.

Taste does not survive a handoff as adjectives. It survives as **prohibitions with
named replacements**, because a prohibition is actionable by a role that has no taste
of its own — which is every role below the seam.

````markdown
## Direction

### Optimise for

One property, named, that wins every tie an issue does not settle.

> Legible across a counter, one-handed, mid-shift, by someone who is not looking.

### Rightly obvious

Where convention wins and nobody should get creative. Off the table — a creativity
push with no such list produces a re-ordered numeric keypad.

> Cart list top-to-bottom, newest last. Keypad in phone order. Cash total
> bottom-right. Do not re-litigate these.

### Prohibitions

The specific clichés this work will land on if nobody stops it, by name, as they
would appear in this codebase. Six to ten. **Each one names a replacement or a
reason — `no X` on its own is a mood, not a constraint.**

> No modal confirm — hands are on the screen, a modal costs two taps and the
>   context behind it. Confirm in place, on the row.
> No spinner-then-toast — the row updates optimistically and reverts visibly.
> No fourth right-side drawer. Three is already a pattern nobody asked for.
> No disabled Pay button — say why it is not payable, in the button.

### Approaches considered

The three the `critic` produced, one paragraph each, and why the winner won. The two
that lost are the reason the winner is not arbitrary, and an implementer who reads
why B lost will not drift back into B halfway through issue 11.
````

### Why each block is there

- **Optimise for** is the tiebreaker for the thousand micro-decisions a spec never
  reaches. That is where median accumulates — not in the decisions anyone argued about.
- **Rightly obvious** is the anti-novelty clause. Convention earns its place at the
  point of least attention, and spending a user's muscle memory to be interesting is
  the failure mode on the creative side of the ledger.
- **Prohibitions** are the only part that survives intact to a role that is executing
  rather than designing, because acting on one requires no judgement.
- **Approaches considered** is what holds design coherence *between issues*. Issues 03
  and 11 of one PRD never share a context; this section is the only thing both read.

### Who enforces it

The `critic`, on its post-build pass, once per PRD. **Not the reviewer.** A third axis
on a two-axis Codex brief dilutes both, and Direction is not falsifiable from a diff.

---

## `## Scenarios` — on the issue

Inline in `.scratch/<prd>/issues/<NN>-<slug>.md`. No new file, no new tool — issue
files are already the contract every role reads.

```markdown
## Scenarios

Status: `?` unreviewed · `Y` must handle · `N` out of scope (reason required) · `L` later (name the slice)

| #  | Scenario                                                       | Status | Note |
|----|----------------------------------------------------------------|--------|------|
| 1  | Shift changes while a transaction is open on the terminal      | ?      |      |
| 2  | Two terminals claim the same drawer within the same second     | ?      |      |
| 3  | Card reader answers after the operator has already voided      | ?      |      |
| 4  | Return of an item whose price changed since purchase           | ?      |      |
| 5  | Network up but 8s round-trip; operator taps Pay twice          | ?      |      |
| …  | (15–20 rows, unfiltered)                                       | ?      |      |
```

### The rules that make it work

- **20 rows minimum, generated unfiltered.** The model is being used for *recall*, not
  for domain knowledge — the weird cases live in the human's head, and reacting to a
  list is far cheaper than generating one. A pre-filtered list of five is worth less
  than twenty, because the fifteen it cut are the ones the human would have kept.
- **A `?` row blocks nothing.** Unreviewed defaults to out-of-scope at implementation
  time. The moment this table gates a merge, it stops getting filled in.
- **`N` requires a reason, and the reason is load-bearing.** It is what stops the
  reviewer raising the same case as a Spec finding three rounds later.
- **Every `Y` is accounted for by the implementer** — a named test, or a line in its
  `## Not handled` report. That single coupling is what turns an invisible gap into a
  tracked one, and it is the whole mechanism.

Setting the status column takes about ninety seconds per issue. That is the price of
the whole thing.

---

## Where each one is produced

| Moment | Who | Writes |
| --- | --- | --- |
| After `/to-spec`, before `/to-tickets` | `critic` | `## Direction` (approaches unpicked) and a PRD-level `## Scenarios` |
| Immediately after | the human | picks one approach; sets every `?` |
| `/to-tickets` | the tickets skill | splits `## Scenarios` rows onto the issues that own them |
| Per issue, at close | `implementer` → orchestrator | `## Not handled`, appended verbatim to the issue |
| After every issue closes, before QA | `critic` | `## Critic — post-build` on the PRD |

The `critic` never returns a verdict and never blocks a merge. That is deliberate: a
critic that can block gets negotiated with, and the negotiation converges on the
median.
