# Code standards

**Who reads this:** `implementer` and `fixer` before editing, and `reviewer` when judging its Standards axis. Nobody else — `explorer`, `qa`, and `decider` never write product code, so this is not loaded into their context.

Nine rules. The reviewer's Standards axis reads this file, so a breach is a finding, not a preference. Rules 1–3 govern what you write, rule 4 governs where it goes, rule 5 governs what you say about it, rules 6–7 govern what it looks like, rule 8 governs how it is imported, rule 9 governs how a form ends.

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
            metadata, error boundaries, and which screens nest inside which
            shell. Whatever this project's router calls this directory
            (pages/, app/, routes/) is the same layer.
features/   the actual UI and logic, in one folder per capability.
components/ chrome shared across this app's features — the shell frame, the
            header, the primary nav, the shared state blocks.
```

**The test is mechanical: a route file contains no JSX.** Every component a route hands the router — `component`, `pendingComponent`, `errorComponent`, `notFoundComponent` — is a bare identifier imported from `features/` or `components/`, never an inline function returning markup. `rg -n '</|/>' apps/*/src/routes` returns nothing.

This holds for all three kinds of route file, and the root is not an exception:

- **`__root.tsx`** hands the router one imported shell component. That component renders the frame and the `<Outlet />`.
- **Pathless layout routes** (`_protected.tsx`, `_protected/layout.tsx`, `(group)/route.tsx`) declare *which screens nest inside which shell*. That nesting **is** the layout the routes layer owns, and it is the whole of it. A layout route that only guards or only groups **omits `component` entirely** — TanStack Router renders an `<Outlet />` for it automatically.
- **Ordinary leaf routes** hand the router one imported feature component.

- DO make a route file import one component and wire the route-level concerns around it.
- DO create a pathless layout route when several screens share a shell. That file is routing, not markup.
- DON'T put markup, layout, or business logic in a route file. "Layout" as a route-level concern means the nesting; the shell's JSX is a component elsewhere (ADR-0009, amended 2026-08-02, and `.scratch/decisions/010-the-word-layout-in-the-routes-layer.md`).
- DON'T hide chrome inside the routes directory under a `-` prefixed folder. Those files are excluded from the route tree but they are still the wrong layer.
- DON'T import anything from `routes/` inside `features/`. **The dependency points one way: routes → features.** A feature reaching back into a route is a finding.
- A route file that grows past wiring means a component is missing. Create it — in `features/` if it owns a capability's data and actions, in `components/` if it is chrome that several features sit inside — and do not grow the route.

This section governs files under `src/routes/`. `src/router.tsx` is not a route file; a one-line `defaultErrorComponent` adapter there is not a breach.

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

## 6. Style from tokens, not from raw values

Colour, spacing, type, radii, and shadow come from `packages/ui` — `theme.css`'s `--color-*`,
`--spacing`, `--text-*`, and the component library built on them. No raw hex, no arbitrary
Tailwind value (`bg-[#35CCA6]`, `p-[13px]`, `shadow-[...]`) in application code. If a shared
part already renders what you need, use it rather than restyling a `<div>` into a near-copy of
it. This is enforced, not just written down — `assertNoRawDesignValues` (`packages/ui/test-seam`)
fails the build on a breach; a rule with no test is forgotten a few screens in, and a test with
no rule is worked around by a fixer who never learned why it exists.

This rule's scope is `apps/pos/src` and `apps/backoffice/src`. `apps/landing` is excluded — it
sits outside the theme entirely (ADR-0013) and gets its own guard in area 11.

`className` must not be assembled elsewhere. A bare identifier (`className={styles}`), a template
literal, or an ad-hoc lookup map (`const toneByStatus: Record<string, string> = {...}` then
`className={toneByStatus[s]}`) hides a class string somewhere the guard — or a reviewer — cannot
see it. Use the variant a component already exposes instead:

```tsx
// banned
const toneByStatus: Record<string, string> = { open: "bg-status-info-tint", ... };
<Badge className={toneByStatus[status]} />

// use the variant the component already exposes
<Badge variant={status === "open" ? "info" : "success"} />

// or, where a class must genuinely vary, inline it
className={cn("size-1.5 rounded-full",
  status === "open" && "bg-status-info-tint",
  status === "done" && "bg-status-success-tint",
)}
```

A `className` value must be a string literal, or a `cn(...)` call whose every argument is a
string literal, the `className` prop, a `cond && "literal"` expression, a `cond ? a : b`
expression whose branches are themselves valid arguments, or a call to a name that is either
bound in the same file by a `const X = cva(...)` initialiser, **or** imported into this file,
ends in `Variants`, and is not also declared locally by anything else in the file
(`badgeVariants({ variant })`, `buttonVariants({ size })`) — that second form is what lets a
component call another file's exported variants function. A same-file `function getVariants()`
does not qualify: the name suffix alone is not a free pass once the guard can tell an import from
a local declaration. `cva` is not banned — it is the generated shadcn idiom, typed against a
variant union, unlike a `Record<string, string>` side-table where a typo silently renders nothing.

The one constraint worth naming explicitly, because a reasonable implementer gets it wrong
otherwise (ADR-0013): the status hues (`success`, `warning`, `info`, `danger`) are dots, chart
series, and icons on a pale tint of themselves — **they never sit under text.** Reaching for
`bg-status-success-tone` and putting a label on it is the predictable mistake; a `-tone` has no
`-foreground` partner because nothing is meant to be written on it.

A named, reasoned escape hatch exists for the rare legitimate case: `// design-exempt: <reason>`
on the line immediately above, reason at least four words. No other marker suppresses it.

## 7. A section of a screen is a `Card`. It is never a bordered `<div>`

**Hard rule, and the one this repository has already got wrong once.** Every distinct section of
a screen — a table and its toolbar, a filter strip, a form group, a stat row, a detail panel —
is wrapped in `Card` from `packages/ui`. White surface on the off-white page ground, generous
radius, the shipped shadow. Separation between regions comes from that surface step, never from
a rule you draw yourself.

So: **no `border-b` under a header, no `border-r` beside a sidebar, no `divide-y` between
regions, no hand-rolled `rounded-lg border p-4` standing in for a `Card`.** A grey line between
two areas of the same colour is the generic admin look this product deliberately is not. Both
`AppShell`s carried exactly that and both were corrected — `.scratch/decisions/019`.

Borders that remain legitimate: the ones already inside a shared part (`Card`'s own edge,
`Input`'s, `Table`'s row rules), and a genuine data-grid separator *within* a card. If you are
adding a border to application code in `apps/*/src`, you are almost certainly rebuilding
something `packages/ui` ships.

**The rule behind the rule, and it settles cases this file does not list.** When the tokens and
the shared parts leave a choice open, the answer is the reference set in
`.scratch/foundation/reference/inspo/` (ADR-0013), and specifically: adopt what the frames
actually contain. Do not fall back on a generic pattern because the mock is silent — the lo-fi
SVGs are silent about appearance *by construction*, and `inspo/` is where appearance was decided.
Do not import the reference's screens or its information architecture either; that boundary is
ADR-0013's and it has not moved. Elements the product already has, wearing the reference's look.

This rule is enforced by review, not by `assertNoRawDesignValues` — the guard reads raw values,
not composition. A reviewer or fixer who finds a bordered section rebuilds it as a `Card` rather
than reporting it as a preference.

## 8. Front-end apps import their own modules as `@/…`, never `../`

In `apps/backoffice`, `apps/pos` and `apps/landing`, a module inside the same app is imported
by its path from that app's `src`:

```tsx
// banned
import { ErrorState } from "../../components/ErrorState.tsx";

// use
import { ErrorState } from "@/components/ErrorState.tsx";
```

`@/*` is declared in each app's `tsconfig.json` and resolved at build and test time by Vite's
native `resolve.tsconfigPaths` (Next resolves it from `tsconfig` on its own). A same-directory
`./sibling.ts` is fine and unaffected — the rule is about climbing out of a directory, which is
what makes a file impossible to move and a diff impossible to read.

**`packages/*` and `apps/api` are excluded, and this is not an oversight.** Other workspaces
compile their source: `apps/api` imports `backend/src/…`, and the two front-end test suites
import `api/src/test-seam-react.tsx`. TypeScript resolves `paths` from the tsconfig of the
project doing the compiling, not from the tsconfig next to the file, so an `@/db/client.ts`
inside `packages/backend` resolves against the *consumer's* `src` and silently types as `{}`.
Bun and Vite resolve it per-file and would not notice; `vp check` does. Those workspaces keep
relative imports until every consumer can be taught the same mapping. Node's `imports` field
(`#/*`) was tried first and rejected: Bun 1.3 does not resolve it, so `bun run src/dev.ts` dies.

`apps/backoffice/tests/import-style-grep.test.ts` enforces the rule for the three apps it
applies to.

## 9. A form's actions are one row: cancel left, the commit right, both with icons

**This rule governs a form's own footer — an editor page or a sheet — and not a
`Dialog`.** Dialogs have their own shape, at the end of this rule. Every form
footer takes the same shape, so a user does not have to re-learn where the safe
exit is on each screen:

```tsx
<div className="flex flex-wrap items-center justify-between gap-2">
  <Button type="button" variant="outline" onClick={onCancel}>
    <XIcon />
    Cancel
  </Button>
  <div className="flex flex-wrap items-center gap-2">
    {/* secondary actions, then the commit last */}
    <Button type="submit">
      <CheckIcon />
      Save changes
    </Button>
  </div>
</div>
```

- **The row is separated from the fields** — `mt-2 border-t pt-4`. A commit
  button flush against the last input reads as part of it.
- **Cancel sits left, alone.** The commit sits at the far right, last in the DOM
  and last in the tab order.
- **Buttons size to their content.** A button inside a `flex-col` form stretches
  to the column's width unless it is wrapped in a row — that stretch is the
  defect this rule exists to prevent, not a style preference.
- **Every action carries a lucide icon before its label.** Icon-only is for
  table rows, where the accessible name lives on `aria-label`; a footer action
  keeps its word.
- Row actions in a list are the mirror image: icon **and** word, `variant="outline"`,
  in a right-aligned column, so the destructive one is never where a cursor
  lands by accident.

**A `Dialog` is the exception, and it is not a defect.** Use `DialogFooter` from
`ui` and put nothing else in it: the pair sits right-aligned, cancel first and
the commit last, with **no separator and no icons**. Every dialog in both apps
is built this way, and a dialog is small enough that the eye finds the commit
without a border to divide it from four inches of form. Reviewers: do not raise
a missing icon or separator on a `DialogFooter` — it is the standard, not a
deviation from it.

## 10. Every mutation toasts its outcome, and the copy lives on `meta`

The `QueryClient` both apps use comes from `createQueryClient()` in `ui`, whose
`MutationCache` toasts every mutation: success on a resolved value, error on a
rejection **and** on the repo's refusal shapes (`null`, `{ ok: false }`). A new
mutation is therefore loud without doing anything, and there is no opt-out —
silence is the defect this exists to prevent.

```ts
useMutation(
  orpc.store.update.mutationOptions({
    onSuccess: invalidate,
    meta: { success: "Store saved", error: "Couldn't update the store" },
  }),
);
```

- **`meta` only swaps the copy.** Leaving it off falls back to "Saved" and
  "Something went wrong" — correct, but say what happened when you can.
- **Toasts do not replace an inline surface.** A sentence a form owns (a
  wrong-password line, a field's policy rejection) stays where it is; the toast
  is the ambient confirmation, not the explanation.
- **`<Toaster />` is mounted once per app** in `main.tsx`, and by the test seam,
  so a screen test can assert the sentence a user would read.

## When this file and the existing code disagree

The existing code is not automatically right, and neither is this file. Say so in your report rather than silently copying the older pattern or silently overriding it. If the disagreement is a real contradiction rather than drift, it goes to the `decider` — a standard and a shipped pattern that contradict each other is exactly the class of question a fixer must not settle by picking a side.
