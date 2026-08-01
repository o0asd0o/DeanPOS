# Code standards

**Who reads this:** `implementer` and `fixer` before editing, and `reviewer` when judging its Standards axis. Nobody else — `explorer`, `qa`, and `decider` never write product code, so this is not loaded into their context.

Five rules. The reviewer's Standards axis reads this file, so a breach is a finding, not a preference. Rules 1–3 govern what you write, rule 4 governs where it goes, rule 5 governs what you say about it.

## 1. One change, one problem

Fix the root cause of what was asked, then stop.

- DO change the smallest set of files that actually fixes the named problem.
- DO fix it at the shared point every caller routes through, not in the one path the issue happened to name. One guard in the shared function is a smaller diff than a guard in every caller — and patching only the named path leaves every sibling caller broken.
- DON'T refactor, rename, reformat, upgrade, or tidy anything the issue did not name.
- Noticed something else worth doing? **Report it. Do not fold it in.** Unrequested work is a review finding even when the work is good.

## 2. One component per file

A file exports exactly one component.

- DO give every new component its own new file, named for the component.
- DON'T declare two components in one file — not a variant, not a wrapper, not a three-line subcomponent.
- A component used by only one sibling still gets its own file.

## 3. Shared helpers live in a `helpers` file next to the components that use them

- DO put a utility in `<folder>/helpers.*` as soon as **two or more** components in that folder need it.
- DON'T copy a helper between components.
- DON'T import another folder's `helpers` — that import is the signal it belongs one level up, or in the project's shared utility module.
- Used by one component only? Leave it in that component's file until a second caller exists.

## 4. Routes stay thin. Features hold the work

```
routes/     route-level concerns ONLY — params, guards, redirects, data loading,
            metadata, error boundaries. Whatever this project's router calls
            this directory (pages/, app/, routes/) is the same layer.
features/   the actual UI and logic, in one folder per capability.
```

- DO make a route file import one feature component and wire the route-level concerns around it.
- DON'T put layout, markup, or business logic in a route file.
- DON'T import anything from `routes/` inside `features/`. **The dependency points one way: routes → features.** A feature reaching back into a route is a finding.
- A route file that grows past wiring means a feature is missing. Create the feature; do not grow the route.

## 5. Comment for the human who maintains this, not for a model reading it

**The reader is a person opening this file cold, six months from now, at 3am.** They can read the code. What they cannot recover is why it is like that.

**Default to no comment.** A comment is justified only when the code cannot carry the information itself. Reach for a clearer name, a smaller function, or an assertion first — those survive refactors, comments rot.

**Write a comment when, and only when:**

- **The why is not visible.** A constraint from outside this file: an API that returns 200 on failure, an ordering another system depends on, a rate limit, a browser or hardware quirk, a legal requirement.
- **The obvious approach is wrong.** Say what you tried and why it failed, or someone will "fix" it back within a month.
- **You cut a corner deliberately.** Name the ceiling and the upgrade path, so it reads as a decision rather than an oversight.
- **A decision lives elsewhere.** Point at the issue, ADR, or `.scratch/decisions/` record that settled it. One line and a path beats a paragraph re-arguing it.

**Never write:**

- **Restatements.** `// increment the counter` above `counter++`. This is the most common kind and adds only maintenance.
- **Change narration.** `// Added X`, `// Updated to handle Y`, `// New in this PR`. Git knows. In six months it is a lie about a file nobody diffed.
- **Anything addressed to a reviewer or an agent.** `// As requested`, `// Note: this satisfies criterion 3`, `// TODO for the reviewer`. Your report is where that goes; the file outlives the review.
- **Section banners and decoration.** `// ===== HELPERS =====`. If a file needs a map, it is too big — see rules 2 and 3.
- **Explanations of the language.** The reader knows what `async` does.
- **A docstring on every function because every function has one.** Document the surprising parameter, not the obvious three.

**Hard ceiling: three lines.** No comment in this repository may exceed three lines, and no
file may carry a multi-paragraph block comment. If what you have to say does not fit, it does
not belong in the file — put it in the `.scratch/decisions/` record, the ADR, or the issue,
and leave one line here pointing at it. A path is not a lesser comment than a paragraph; it is
a better one, because it stays true when the reasoning changes.

**Prefer no comment at all.** The bar is not "is this true and useful" — it is "would the next
maintainer lose something real if I deleted this". Most comments fail that. Reach for a clearer
name or a smaller function first.

**Style:** plain sentences, the vocabulary from the project's glossary, and no hedging. Prefer one specific line over three general ones. If the comment is longer than the code it explains, the code needs restructuring, not prose.

A useful test before you keep a comment: **delete it and re-read the code.** If nothing was lost, it was noise.

## When this file and the existing code disagree

The existing code is not automatically right, and neither is this file. Say so in your report rather than silently copying the older pattern or silently overriding it. If the disagreement is a real contradiction rather than drift, it goes to the `decider` — a standard and a shipped pattern that contradict each other is exactly the class of question a fixer must not settle by picking a side.
