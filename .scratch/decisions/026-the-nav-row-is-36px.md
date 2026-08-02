# 026: A nav row is 36px tall with 10px of padding, set on the shared variant rather than in the app

- **Status:** decided
- **Stakes:** low
- **Date:** 2026-08-02
- **Asked by:** human (direct: *"can you add padding to the menu items? like 2px more and have it taller like 36px"*)

## The question

The pulled sidebar's menu rows shipped at shadcn's defaults — `h-8` (32px) with `p-2` (8px). Against
the reference's roomier nav, and after the rows gained icons (record 018), they read tight.

**Where does a nav row's height and padding get set?**

## What I chose, and why

**`h-8` → `h-9` and `p-2` → `p-2.5` in `sidebarMenuButtonVariants`**, the cva in
`packages/ui/src/components/sidebar.tsx`. Measured live: **36px tall, 10px padding.**

Both are `className` slots that already existed, which is the edit class issue 13's regeneratable
baseline tolerates and record 017 called mechanically re-appliable — as against adding a branch or
a prop, which has to be re-authored by hand after every regeneration.

**Not in `NavGroup`.** Overriding height on the app's call site is the tempting one-liner and it is
the pattern record 019 exists to stop: the shared part would still claim 32px while every consumer
patched it, and the next consumer would patch it differently. One source for what a nav row is.

**The numbers are spacing steps, not raw values.** `h-9` and `p-2.5` are `9 × --spacing` and
`2.5 × --spacing`, so both scale with density rather than freezing a pixel. At compact
(`--spacing: 0.25rem`) that is the 36px and 10px asked for.

## What this means for `apps/pos`

Touch sets `--spacing: 0.3125rem` (record 013), so the same classes render **45px tall with 12.5px
padding** there — above the 44px floor `--tap-size` enforces, which is the density system doing its
job rather than a coincidence. The terminal has no sidebar today, so nothing changes on screen; this
is what a later area inherits if it adds one.

## What would make this decision wrong

- **The vertical rhythm of a long nav.** Twenty-one rows at 36px plus three group headings is
  taller than the same nav at 32px, so the sidebar starts scrolling at a taller viewport than
  before. Record 023's slim scrollbar is what that now looks like. If it scrolls too eagerly in
  use, the answer is tighter group spacing, not shorter rows.
- **`sm` and `lg` were left alone** (`h-7`, `h-12`). Nothing uses them yet. If a consumer picks one
  and finds it out of proportion with the new default, the scale wants a pass, not another
  one-off.

## Evidence

- `packages/ui/src/components/sidebar.tsx:448, 457` — the base class string and the `default` size.
- `.scratch/decisions/013` — the density mechanism `h-9` rides on.
- `.scratch/decisions/019` — why this is in `packages/ui` and not in `NavGroup`.
- Measured in the running app: `{height: 36, padding: "10px"}` on the first menu button.
- `ui check` and `ui test` (107) pass.
