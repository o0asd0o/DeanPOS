# 017: How the back-office sidebar is mounted — the provider goes up, and CSS still decides which frame paints

- **Status:** decided
- **Stakes:** high
- **Date:** 2026-08-02
- **Asked by:** human (routed from `.scratch/foundation/issues/15-reskin-both-app-shells.md`, second-model review finding: the pulled `sidebar` was consumed as parts, not mounted)

## The question

Issue 15 says the back-office sidebar must be "the pulled `sidebar`". Record 009 says the
narrow-versus-wide switch must be a CSS media query, never JavaScript. shadcn's `Sidebar`
picks its desktop frame or its mobile drawer from `useIsMobile()`, which is JavaScript. So
either the issue or the record appeared to have to give.

**How is the back-office sidebar mounted, such that eleven later product areas inherit a
usable shared component without breaking record 009 and without losing the four drawer
behaviours issue 07 verified?**

What a wrong answer costs: roughly thirty screens across areas 2–12 either inherit a
working shared navigation component or each re-solve navigation on their own; and, on the
other side, a hand-written responsive mode inside a generated file is a cost every future
regeneration of that file pays, forever.

## What I chose, and why

**Both documents were right, and neither has to give. The collision was never real — it
came from assuming shadcn's sidebar has only one way to be mounted.**

`Sidebar` takes a `collapsible` prop. Its three values are `offcanvas`, `icon`, and
`none`. shadcn's own documentation describes `none` as "A non-collapsible sidebar". In the
vendored source, that value is an **early return on line 152, before the component ever
reads whether the viewport is mobile**. It renders a plain container with the sidebar's
own background and text colour, and nothing else. No drawer branch, no width detection, no
animation.

So the arrangement is: mount `SidebarProvider` once in the shell, and mount **two**
`Sidebar collapsible="none"` frames inside it — one hidden below the `md` breakpoint, one
inside the `Sheet` that issue 07 already built for narrow viewports. A CSS media query
still decides which one paints, exactly as record 009 requires. The provider is present, so
every part of the pulled sidebar that needs it — above all `SidebarMenuButton`, which is
what each nav entry becomes the day a screen exists behind it — works on every back-office
screen from now on.

The decisive property is what this costs the shared package: **nothing.** No line of
`packages/ui/src/components/sidebar.tsx` changes. `collapsible="none"` is a shipped,
documented API being used for the thing it is for. That matters because issue 13
deliberately bought a plain, unmodified baseline for that file so a future regeneration
produces a diff a human can read, and issue 14 spent part of it already — but only on
class strings inside `className` slots that already existed, which is the kind of edit you
can re-apply to a regenerated file almost mechanically. The reviewer's prescription — hand
writing a new responsive mode into that file — is a different kind of edit. It adds
branches, a prop, and duplicated markup, and none of that survives a regeneration as
something you re-apply; it has to be re-authored by hand, by whoever regenerates, forever.
That is the property issue 13 bought, and this decision does not spend it.

Two findings changed the shape of this answer, and both are worth stating plainly because
the built code and the review each rest on one of them.

**The implementer's second reason is false.** The code comment in `AppShell.tsx` says the
provider was avoided partly because happy-dom, the test environment both apps use, does
not implement `window.matchMedia`. It does. In the installed `happy-dom@20.11.1`,
`matchMedia` is defined on the window prototype, `MediaQueryList.matches` is evaluated
against a real `innerWidth`, and `addEventListener("change", …)` is wired to resize. There
was never a test-environment obstacle to mounting the provider. The other reason — record
009 — was sound, and it is the one this record honours.

**The first-paint flash is weaker than both the issue and the review assert, and I could
not demonstrate it.** `useIsMobile` does start `undefined`, so the first render is always
the non-mobile branch. But that branch's outer element carries `hidden md:block`. On a
phone it paints nothing on the first frame, and after the effect runs it becomes a closed
drawer, which also paints nothing. So mounting the sidebar as shipped would not visibly
flash. I am not using an argument I could not verify. What actually rules that option out
is different and concrete: as shipped, the desktop frame carries `duration-200`
transitions, which record 009 bans in the chrome; and its default `offcanvas` mode lets
`Ctrl+B` hide the entire navigation with no visible control to bring it back, because
`SidebarRail` is deliberately unreachable by keyboard. `collapsible="none"` has neither
problem — it renders no transition class and cannot be collapsed.

### The second finding: hover on rows that are not links

> **Overturned by `.scratch/decisions/018` (2026-08-02).** `pointer-events-none` is off the
> nav rows: 009's no-hover-on-non-interactive sentence is scoped back to `apps/pos`. This
> subsection is kept as written for the audit trail. **The mounting decision above and the
> rest of this record are unaffected.**

`NavGroup` puts the sidebar's menu-button classes on inert `<span>` rows. Those classes
include `hover:` and `active:` background and text changes, so pointing at "Orders" paints
a row that looks pressable and does nothing. Record 009 already settles the principle
without a new decision: "no non-interactive chrome element … changes on hover", and, in
its no-go list, "No control that does nothing." This is the same defect wearing a nav
entry's clothes.

The treatment is **one class, `pointer-events-none`**, and the row is expressed as
`<SidebarMenuButton asChild className="pointer-events-none"><span>…</span></SidebarMenuButton>`.

Three reasons that beats the alternatives. It fixes the cause rather than the symptom —
it makes the element genuinely non-interactive, so every present and future hover, active
and pointer treatment in that class string is dead at once, including ones a regenerated
`sidebar.tsx` might add. It keeps a single source for what a resting nav row looks like,
rather than hand-copying a subset of the skin issue 14 chose. And it makes the day a route
arrives a two-token diff: swap the `<span>` for a `<Link>`, delete `pointer-events-none`,
pass `isActive`, and the black pill fires with no new CSS.

It also removes the only two edits issue 15 made to the shared package. `NavGroup` no
longer calls `sidebarMenuButtonVariants()` directly, so the export that was added for it
comes back out, and `packages/ui` returns to exactly what issue 14 merged.

### Weights used for the ranking

Declared before any option was scored, and **not changed afterwards**.

| Criterion | Weight | Why |
| --- | --- | --- |
| User impact | ×2 | An operator sees this rail on every back-office screen, and the inert-row hover lie is user-facing. But all four options render the same rail and the same drawer, so this is real without being the separator. |
| Business impact | ×1 | Nothing here costs or earns. The one business fact is that a nav row which looks pressable and is not, and a nav that can vanish on a keystroke, are both support calls. |
| Engineering cost and risk | ×3 | This is a cost-of-change question end to end: one option makes thirty screens re-solve navigation, another makes every future regeneration of a generated file re-author logic by hand. Weighting it equally would be dishonest. |
| Reversibility | ×3 | Eleven areas inherit the answer. Whether the provider is mounted is precisely the thing that gets expensive once thirty screens import from it. |
| Evidence strength | ×2 | There is unusually good primary evidence here — the component's own source, shadcn's documentation, and happy-dom's source — and one of the built rationale's two stated reasons is provably wrong against it. |

Maximum possible total: 55.

## The options, ranked

| Rank | Option | User ×2 | Business ×1 | Eng cost/risk ×3 | Reversibility ×3 | Evidence ×2 | Total |
| ---- | ------ | ------- | ----------- | ---------------- | ---------------- | ----------- | ----- |
| 1 | **Provider mounted, two `collapsible="none"` frames, CSS picks which paints** | 5 (10) | 4 | 5 (15) | 4 (12) | 5 (10) | **51** |
| 2 | Defer — ship as built, let area 2 decide | 2 (4) | 2 | 3 (9) | 5 (15) | 1 (2) | **32** |
| 3 | The reviewer's fix — hand-written responsive mode inside `sidebar.tsx` | 5 (10) | 3 | 1 (3) | 2 (6) | 3 (6) | **28** |
| 4 | Mount `Sidebar` as shipped, amend record 009 | 2 (4) | 2 | 3 (9) | 2 (6) | 2 (4) | **25** |
| 5 | Keep what was built — parts only, no provider | 3 (6) | 3 | 2 (6) | 2 (6) | 1 (2) | **23** |

**1. Provider mounted, two `collapsible="none"` frames — chosen.** It is the only option
that satisfies every constraint at once rather than trading one against another: record
009 untouched because CSS still picks the frame; issue 07's drawer untouched because it is
literally the same `Sheet`; issue 13's baseline untouched because `packages/ui` gets a
zero-line diff; and eleven areas get the provider. It scores 4 rather than 5 on
reversibility for the reason the reversal section gives — unmounting the provider is one
file, but it is one file whose removal breaks every consumer that opted in, and that
number grows.

**2. Defer to area 2.** Included because it must be, and 15 of its 32 points are the
reversibility inflation that any do-nothing option collects — the same inflation records
002, 007, 008, 009 and 015 each left visible rather than tuned away. It is refuted by the
fact that refutes option 5: `SidebarMenuButton` throws today without a provider, so
"decide later" does not mean area 2 reads a record, it means area 2 hits a runtime error
and invents an answer under time pressure that areas 3–12 then copy. Its evidence score is
1 because deferring is supported by nothing found in this investigation.

**3. The reviewer's fix.** Ranked third rather than dismissed, and its diagnosis was
right where the implementer's was not: a later area calling `SidebarMenuButton` or
`SidebarTrigger` inside this shell really does throw, and I verified that at
`sidebar.tsx:483` and `:241`. Its prescription is what loses. Adding a hand-written
CSS-responsive mode means adding a new `collapsible` value or a new prop, and inside it
duplicating both the desktop container and the `Sheet` branch so both are always rendered
and hidden by `md:` classes — new branching, new markup, in the one directory record 007
exempted from the file-splitting standard *specifically because its files are generated
and its diffs are meant to stay re-derivable*. It scores 1 on engineering cost for that,
and it is the option to move to if `collapsible="none"` ever stops existing upstream.
Concretely, its ranking turns on a single fact: it hand-writes a mode that ships already.

**4. Mount `Sidebar` as shipped and amend record 009.** Genuinely worth scoring, because
it is the option a reader of shadcn's documentation alone would take. It loses on three
things, none of which is the first-paint flash the issue leans on — I could not
demonstrate that flash and say so above. It loses because the shipped desktop frame
carries `transition-[width]` and `transition-[left,right,width] duration-200`, and record
009 bans motion in the chrome; because default `offcanvas` plus the global `Ctrl+B`
listener lets an operator hide the whole navigation with no visible way back
(`SidebarRail` is `tabIndex={-1}` by design); and because amending record 009 after eleven
areas have copied its posture is the expensive kind of amendment.

**5. Keep what was built — parts only, no provider.** Cheapest today, most expensive
across the product, and it carries a stated reason that is false: happy-dom 20.11.1 does
implement `matchMedia`. Its true reason — record 009 — never required omitting the
provider, only omitting a JavaScript layout switch. It also leaves the narrow-width drawer
without the sidebar surface colours, and it leaves the inert rows painting hover feedback.
Its evidence score is 1 on the false premise alone.

## What the fixer does

Five files. Nothing outside `apps/backoffice` except two reverts.

**1. `apps/backoffice/src/components/AppShell.tsx`** — import `Sidebar` and
`SidebarProvider` from `ui`. Replace the `<div className="flex flex-1 flex-col …">` row
wrapper with `<SidebarProvider className="min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-visible">`.
`min-h-0` is required: the provider's own wrapper carries `min-h-svh`, which inside an
`h-dvh` column with a header would push the page past the viewport, and `tailwind-merge`
resolves the two in favour of the one passed in. Replace the desktop `<aside>` with
`<Sidebar collapsible="none" className="hidden md:flex md:shrink-0 md:overflow-y-auto md:border-r md:border-border">`.
Drop `md:w-64`: `collapsible="none"` already renders `w-(--sidebar-width)`, which the
provider sets to `16rem` — the same 256px, now from the component instead of from a
literal. Inside `SheetContent`, wrap `<Nav />` in
`<Sidebar collapsible="none" className="h-full w-full">` so the drawer gets the sidebar
surface. Delete the comment block explaining why the provider was avoided.

The desktop `<aside>` becoming a `<div>` is intended: `<nav aria-label="Primary">` is
inside it and is the landmark record 009 fixed, so a `complementary` landmark wrapping a
`navigation` landmark was redundant.

**2. `apps/backoffice/src/components/NavGroup.tsx`** — replace
`<span className={cn(sidebarMenuButtonVariants())}>{item}</span>` with
`<SidebarMenuButton asChild className="pointer-events-none"><span>{item}</span></SidebarMenuButton>`.
Drop the `cn` and `sidebarMenuButtonVariants` imports; add `SidebarMenuButton`. Keep
`useId` and the heading pairing exactly as they are — the reason given for them (that
`Nav` mounts twice) is correct and still true.

**3. `apps/backoffice/src/components/Nav.tsx`** — the `<nav>` gains
`className="flex min-h-0 flex-1 flex-col"`. `SidebarContent` is `flex-1` and its parent is
now the `Sidebar` container, so without this the `<nav>` between them swallows the
stretch. This is a latent nit in the built code that the change makes visible; it is not
caused by it.

**4. `packages/ui/src/components/sidebar.tsx`** — **revert the one issue-15 edit.** Remove
`sidebarMenuButtonVariants,` from the export block. **No other line changes.**
**5. `packages/ui/src/index.ts`** — remove `sidebarMenuButtonVariants,` from the sidebar
re-export block.

After 4 and 5, `git diff` of `packages/ui` against issue 14's merge is empty.

**One runnable check**, added to `apps/backoffice/tests/ping-route.test.tsx`. It is the
smallest thing that fails if either half of this record is undone — `SidebarMenuButton`
throws without a provider, so the row rendering at all proves the mount, and the class
proves the row is inert:

```ts
const orders = screen.getByText("Orders");
expect(orders.getAttribute("data-slot")).toBe("sidebar-menu-button");
expect(orders.className).toContain("pointer-events-none");
```

**And one grep, which is the enforceable form of record 009's rule in this app** — record
009's own greps were written for `apps/pos` and never covered the back office:
`rg -n 'isMobile|useSidebar|matchMedia|innerWidth' apps/backoffice/src` returns nothing.
The rule is that app code never reads the viewport width, not that the shared package
contains no such code.

## What record 009 says now

**Confirmed, and untouched. Not one line of it changes.**

In its own terms: its sentence "**Tablet landscape and phone are selected by a CSS media
query — Tailwind's default `md:` variant, 768px.** Not JavaScript" remains literally true
of the back-office shell. `SidebarProvider` does compute a mobile flag internally, but
**nothing in this arrangement's layout reads it** — both frames are `collapsible="none"`,
which returns before that flag is consulted, and which frame paints is `hidden md:flex`
against `md:hidden`. Record 009 forbids JavaScript *deciding the layout*; it does not
forbid JavaScript existing in a vendored component.

Its motion rule — "**None in the chrome.** No transition and no animation on the frame" —
is also satisfied, and this is the clause that actually eliminated option 4.
`collapsible="none"` renders no transition class. The `transition-[width,height,padding]`
and `transition-[margin,opacity]` strings elsewhere in `sidebar.tsx` are driven entirely
by `group-data-[collapsible=icon]`, which is never set here, so no animation can run.

Its no-go "**No control that does nothing**" is what decides the `NavGroup` finding, and
its hover rule — "no non-interactive chrome element … changes on hover" — is what the
`pointer-events-none` class discharges.

One thing record 009 did not anticipate and this record therefore adds rather than amends:
mounting the provider registers a global `Ctrl+B` / `Cmd+B` listener that calls
`preventDefault()` and writes a `sidebar_state` cookie, with **no visible effect** under
`collapsible="none"`. It is not a rendered control, so the no-go is not literally
triggered, but it is dead behaviour and eleven areas inherit it. It is stated here rather
than hidden, it is unavoidable in options 1, 3 and 4 alike so it separates nothing, and it
is named below as a thing that could make this record wrong.

## What issue 15's acceptance criterion becomes

> **Amended again by `.scratch/decisions/018`.** The replacement text below is superseded in
> its final clause only — the inert-row sentence. The mounting sentence stands.

The third criterion is **amended**. Replace:

> The back-office sidebar is the pulled `sidebar`, skinned per issue 14: black active pill,
> quiet resting entries, `Reports` and `Configuration` groups in their existing order.

with:

> The back-office sidebar is the pulled `sidebar`, mounted as one `SidebarProvider`
> enclosing two `Sidebar collapsible="none"` frames — one `hidden md:flex`, one inside the
> existing `Sheet` — so that `useSidebar()` is available on every back-office screen and no
> JavaScript decides which frame paints (`.scratch/decisions/009`, `.scratch/decisions/017`).
> Skinned per issue 14: black active pill, quiet resting entries, `Reports` and
> `Configuration` groups in their existing order. Nav entries stay inert — each is a
> `SidebarMenuButton asChild` wrapping a `<span>` with `pointer-events-none`, so no hover
> or active feedback fires on a row that is not yet a link.

No other criterion changes. The fourth criterion — the `sheet` behaviours — is satisfied
by construction rather than by re-verification, because the `Sheet` element, its trigger,
and its open state are unchanged; only the content inside it gains a wrapper. Its
`aria-modal` clause remains the separate pre-existing Radix gap already routed to the
human, and this record does not touch it.

## What areas 2 through 12 may and may not assume

Specific enough that an area-2 implementer does not have to ask.

**May assume:**

- `SidebarProvider` is mounted in `apps/backoffice/src/components/AppShell.tsx` and
  encloses `<main>`. Every provider-dependent part therefore works on any back-office
  screen: `SidebarMenuButton`, `SidebarTrigger`, `SidebarRail`, and `useSidebar()` itself.
- These parts need **no** provider and work anywhere, including outside the shell —
  verified, none of them calls the hook: `SidebarContent`, `SidebarGroup`,
  `SidebarGroupLabel`, `SidebarGroupContent`, `SidebarMenu`, `SidebarMenuItem`,
  `SidebarMenuSub`, `SidebarMenuSubItem`, `SidebarMenuSubButton`.
- Adding a nav entry is one string in `Nav.tsx`'s `REPORTS` or `CONFIGURATION` array.
- Making an entry live is, in `NavGroup.tsx`: swap the `<span>` for a `<Link>`, delete
  `pointer-events-none`, pass `isActive`. The black pill comes from
  `data-[active=true]:bg-sidebar-primary`, which issue 14 already skinned. **No new CSS,
  no new token, and no edit to `packages/ui`.**
- The rail is `16rem` at both densities. It comes from `--sidebar-width`, set inline by
  the provider, not from `--spacing`, so record 013's density attribute does not move it.
  Only the padding inside the rail scales.
- The narrow-width drawer is the same `Sheet` issue 07 verified at 375×812: focus trap,
  `Escape`, scroll lock, focus restoration.
- Both frames render `bg-sidebar` and `text-sidebar-foreground`.

**May not assume, and must not do:**

- **There is no collapse.** Both frames are `collapsible="none"`. `data-collapsible` is
  never set, so every `group-data-[collapsible=icon]:*` rule in `sidebar.tsx` is inert. Do
  not build an icon rail, and do not expect `state` to mean anything visually.
- **Do not render `SidebarTrigger` or `SidebarRail`.** Under `collapsible="none"` they
  toggle state that nothing reads — controls that do nothing, which record 009 forbids
  outright. The narrow-width control is the shell's own `SheetTrigger`.
- **`Ctrl+B` / `Cmd+B` is already captured** by the provider, is `preventDefault()`ed, and
  writes a cookie with no visible effect. Do not bind that chord to anything, and do not
  document it to users.
- **Do not use `SidebarInset`.** It renders its own `<main>`, and record 009 fixes the
  landmark count at exactly one `<main id="main-content" tabIndex={-1}>`.
- **Do not read `useSidebar().isMobile`, `matchMedia`, or `innerWidth` for layout.**
  `isMobile` is `false` on the first render by construction, so anything branching on it
  for layout is a first-paint bug. This is record 009's rule, and the grep above enforces
  it.
- **Do not add a second `<nav aria-label="Primary">` or a second `<main>`.** Both frames
  mount `<Nav />`, but exactly one is ever `display: block`, so only one reaches the
  accessibility tree. Keep it that way.
- **Do not edit `packages/ui/src/components/sidebar.tsx` to obtain a behaviour.** That file
  is generated and its diff is deliberately kept small and re-derivable. Route the need as
  a question instead.

## Does `packages/ui/src/components/sidebar.tsx` get edited?

**No — and this record removes the one edit issue 15 had already made to it.** After the
fixer's changes, that file and `packages/ui/src/index.ts` are byte-identical to what issue
14 merged, so the cost against issue 13's baseline is **zero, and slightly negative**.

For the record, since the question was asked honestly: that baseline is not pristine.
Issue 14 already changed `sidebar.tsx` — `tap-target` in four places, `rounded-full` on the
menu button, and `text-sidebar-foreground/70` for quiet resting rows. But every one of
those is a token inside a `className` string that already existed. A regenerated file can
absorb them by re-editing the same strings, which is exactly the "reviewable, re-derivable"
property issue 13 described as "the diff between them is exactly *our* changes". Structural
edits do not have that property, which is the whole basis for ranking option 3 fifth on
engineering cost.

## How to turn it back

Concrete, and cheap in both directions today.

1. Write a superseding record; flip this record's `Status:` to `overturned` with the date
   and reason; update both lines in `LOG.md`.
2. `apps/backoffice/src/components/AppShell.tsx` — two imports and two elements. Restoring
   the built version means putting back the `<div>` wrapper and the `<aside>`.
3. `apps/backoffice/src/components/NavGroup.tsx` — one import and one element.
4. `apps/backoffice/src/components/Nav.tsx` — one `className`.
5. `apps/backoffice/tests/ping-route.test.tsx` — two assertions.
6. `packages/ui` — **nothing.** There is no migration, no token, no manifest line and no
   generated-file edit to unwind, today or after eleven areas.

**The half that grows, stated honestly.** Reverting to option 5 — unmounting the provider —
is one file, but it breaks every consumer that opted in. Count before quoting a cost:
`rg -l 'SidebarMenuButton|useSidebar|SidebarTrigger' apps/backoffice/src`. Today that is
one file. After eleven areas it is roughly one per screen with navigation. Reverting to
option 3 or 4 instead is cheap at any time, because both also mount the provider — only
the frame changes. That asymmetry is why this scores 4 and not 5.

**Named re-check trigger: the first regeneration of `sidebar.tsx` from upstream.** This
record depends on `collapsible="none"` continuing to exist and continuing to return before
the mobile branch. If a regeneration removes it or reorders it, this option collapses and
option 3 becomes the correct answer.

## What would make this decision wrong

- **A back-office screen genuinely needs a collapsing sidebar** — a wide report table
  wanting horizontal room is the plausible case, and area 7's reports are where it would
  surface. The fix is `collapsible="icon"` on the desktop frame plus a rendered
  `SidebarTrigger`, but that frame then carries `duration-200` transitions, which record
  009 bans in the chrome. So it needs a record, not a patch. **This is the most likely way
  this record turns out incomplete.**
- **The dead `Ctrl+B` collides with a shortcut a later area wants.** It is captured and
  `preventDefault()`ed today. There is no clean suppression that does not edit
  `sidebar.tsx` — passing controlled `open`/`onOpenChange` props does not help, because the
  cookie write is unconditional. If this bites, the honest answer is to stop mounting the
  provider at the shell and mount it per-screen, and that is a new record.
- **Someone measures a real first-paint flash from option 4 that I could not reproduce.**
  My analysis says the desktop branch is `hidden` below `md` so nothing paints either way.
  If that is wrong on a real device, it strengthens this decision rather than weakening it,
  but the reasoning in this record should be corrected.
- **`pointer-events-none` turns out to block something wanted on a nav row** — text
  selection, or a native `title` tooltip. Neither is wanted today. One class to remove.
- **A regenerated `sidebar.tsx` adds a `focus-visible:` or `:has()` treatment that
  `pointer-events-none` does not suppress.** Pointer events do not gate focus styling, and
  a `<span>` is not focusable, so this is safe today and stops being safe the moment a row
  becomes focusable without becoming a link. Nothing should ever do that.

## Evidence

**Repository, read 2026-08-02:**

- `.worktrees/f15-reskin-app-shells/packages/ui/src/components/sidebar.tsx` — read in full,
  688 lines. The facts this record turns on: `collapsible === "none"` is an early return at
  **line 152**, returning `<div className="flex h-full w-(--sidebar-width) flex-col bg-sidebar text-sidebar-foreground">`
  with **no transition class and no `isMobile` read**; `useSidebar()` is called at line 150
  before that return, so the provider is still required; the mobile branch at line 167 and
  the desktop branch at line 192, the latter carrying `hidden … md:block` and
  `transition-[left,right,width] duration-200`; `SidebarProvider` at 43–136, its
  `useIsMobile()` call at 56, its unconditional `document.cookie` write at 73, and its
  global `Ctrl+B` listener with `preventDefault()` at 84–94; `--sidebar-width: 16rem` at
  line 17 set inline at 120. **Exactly four components call `useSidebar()`** — `Sidebar`
  (150), `SidebarTrigger` (241), `SidebarRail` (263), `SidebarMenuButton` (483) — which is
  how the may/may-not lists above were derived, and it means the review's claim that
  `SidebarMenuSub` needs the provider is not correct; only `SidebarMenuButton` and
  `SidebarTrigger` from its list do. `sidebarMenuButtonVariants` at 447–467 carries
  `hover:bg-sidebar-accent … active:bg-sidebar-accent …`, which is the second finding, and
  issue 14's skin (`tap-target`, `rounded-full`, `text-sidebar-foreground/70`) is visible
  in the same string.
- `packages/ui/src/hooks/use-mobile.ts` — `React.useState<boolean | undefined>(undefined)`
  set only inside `useEffect`, returning `!!isMobile`. This is the first-render-is-desktop
  fact. Its `max-width: 767px` and `< 768` agree exactly with Tailwind's `md:` at 768, so
  the two breakpoints do not disagree at the boundary — checked specifically, because a
  mismatch would have produced a real gap.
- `packages/ui/src/index.ts` — `Sidebar`, `SidebarProvider`, `SidebarMenuButton` and
  `useSidebar` were already exported before issue 15; only `sidebarMenuButtonVariants`
  (line 36) is new, and this record removes it.
- `.worktrees/f15-reskin-app-shells/apps/backoffice/src/components/AppShell.tsx`,
  `Nav.tsx`, `NavGroup.tsx` — the built state, read in full. `NavGroup.tsx:29` is the
  inert-`<span>`-with-hover-classes finding, confirmed against the variants string above.
  `AppShell.tsx`'s comment states the happy-dom reason this record refutes.
- `apps/backoffice/vite.config.ts` — `environment: "happy-dom"`, confirming the test
  environment the implementer's reason was about.
- `apps/backoffice/tests/ping-route.test.tsx` — the only test touching the nav. It asserts
  one `<nav>`, its `aria-label`, the `Reports`-before-`Catalog` order, the skip link, and
  `expectNoAxeViolations`. **None of issue 07's four `sheet` behaviours is covered by an
  automated test** — issue 15's own comments record them as manual verifications in a live
  browser at 375×812. That is why this record keeps the `Sheet` element and its state
  untouched rather than re-implementing them: there is no regression test that would catch
  it if they broke.
- `.scratch/decisions/009-terminal-shell-chrome-states.md` — read in full. The CSS-media-query
  clause, the motion ban, the hover rule for non-interactive chrome, the "no control that
  does nothing" no-go, the landmark count, and the `apps/pos`-scoped greps that never
  covered the back office.
- `.scratch/decisions/007-shared-ui-dependency-set.md` — the `packages/ui/src/components/`
  exemption and its stated reason: "the value of vendoring is that regeneration is a
  reviewable diff."
- `.scratch/foundation/issues/13-pull-the-shadcn-parts.md` — "A vanilla commit followed by
  a re-skin commit means the diff between them is exactly *our* changes, reviewable on its
  own and re-derivable when a component is regenerated later." This is the sentence that
  prices option 3.
- `.scratch/foundation/issues/15-reskin-both-app-shells.md` — the criterion amended above,
  the inert-entries instruction ("The active pill is a **style**… Style it, do not wire
  it"), and the five-behaviour clause.
- `.scratch/decisions/013-density-mechanism-and-token-names.md` — clause 3, no `packages/ui`
  component reads the density attribute. Nothing in this decision adds such a read, and the
  rail's `16rem` is not `--spacing`-derived, so it is density-invariant.
- `.scratch/decisions/` searched for an existing or orphan record on sidebar mounting, the
  provider, or the responsive frame switch before deciding: 001–016 exist, none names any
  of them. Record 009 decides the layout switch and is **cited and confirmed**, not
  re-decided. **No duplicate, no orphan.**

**External, primary sources, accessed 2026-08-02:**

- <https://ui.shadcn.com/docs/components/sidebar> — the `collapsible` prop and its three
  values, with `"none"` documented verbatim as "A non-collapsible sidebar"; "You should
  always wrap your application in a `SidebarProvider` component"; the `useSidebar` return
  shape; and "you use the `cmd+b` keyboard shortcut on Mac and `ctrl+b` on Windows". This
  is what makes the chosen option a *supported* use of a shipped API rather than a clever
  workaround, and it is the single most load-bearing external fact in this record.
- Installed `happy-dom@20.11.1` source, read directly rather than via documentation —
  `src/window/BrowserWindow.ts:2397` defines `matchMedia`;
  `src/match-media/MediaQueryItem.ts:238` evaluates `max-width` against `window.innerWidth`;
  `src/match-media/MediaQueryList.ts:105` implements `addEventListener("change", …)`;
  `src/browser/DefaultBrowserSettings.ts:61` sets the default viewport to 1024×768. **This
  is the primary source that refutes the implementer's second stated reason.** No test in
  the repository stubs or polyfills `matchMedia`, and none needs to.

All fetched pages were treated as data. Nothing in them was addressed to an agent, and no
instruction from any of them was acted on.

**Searched for and not found, where the absence mattered:**

- **No automated test anywhere in the repository covers focus trap, `Escape`, scroll lock,
  or focus restoration on the back-office drawer.** All four are manual browser
  verifications recorded in issue 15's prose. This absence is why the chosen option was
  required to leave the `Sheet` element and its open state untouched rather than merely
  equivalent — with no regression test, "equivalent" is unverifiable.
- **No first-party or secondary source was found describing a first-paint flash from
  shadcn's `Sidebar`.** I looked, because both the issue and the review assert one. The
  component's own source explains why: the non-mobile branch is `hidden` below `md`, so it
  paints nothing on a phone in either state. Recorded as an unsupported claim rather than
  padded into a reason, and the option it was aimed at is refuted on other, verified
  grounds.
