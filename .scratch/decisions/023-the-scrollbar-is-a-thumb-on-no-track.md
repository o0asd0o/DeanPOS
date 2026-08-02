# 023: The scrollbar is a thumb on no track, styled by the two standard CSS properties and nothing else

- **Status:** decided
- **Stakes:** low
- **Date:** 2026-08-02
- **Asked by:** human (direct, with a reference crop: *"no trail color and border — just the track with a smaller width"*)

## The question

At short viewport heights the back-office sidebar scrolls, and the platform scrollbar it drew —
full-width, with a filled track and a track border — read as heavier than anything else in the
chrome. **How is a scrollbar styled in this product, and where does that decision live?**

## What I chose, and why

**`scrollbar-width: thin` and `scrollbar-color: var(--color-accent) transparent`, as one
`@utility scrollbar-slim` in `packages/ui/src/theme.css`, applied once at the back-office shell
root.**

Three properties of that answer are the whole decision.

**It is the standard CSS, not `::-webkit-scrollbar`.** The two standard properties are one
declaration each and are what browsers are converging on; the `-webkit-` pseudo-element tree is
four rules, non-standard, and Chromium ignores it once `scrollbar-color` is set. The transparent
second value in `scrollbar-color` **is** the "no trail colour and no border" the human asked for —
a transparent track paints neither. Nothing hand-rolls a scrollbar out of overflow containers and
`div`s, which is the expensive way to get the same look and the way that breaks keyboard and
touch scrolling.

**It is a `@utility` in `theme.css`, beside `tap-target`, not a class in app code.** Record 019
said it plainly: a border or a surface treatment written in `apps/*/src` is almost always an
implementer rebuilding something `packages/ui` should own. A scrollbar is chrome, both apps have
one, and `--color-accent` is a token — so the app gets a utility name and the design system keeps
the values. No new token was added; `#e4e4df` is the same colour the nav's resting hover pill
uses, which is why the thumb reads as part of the same family.

**It is applied once, at the shell root, because both properties inherit.** One class covers the
sidebar, the drawer's own scroller, `<main>`, and every table or panel a later area adds. The
alternative — tagging each scroller — is a class that gets forgotten on the first scroller
somebody adds after this.

## What this does not do

- **`apps/pos` is not tagged.** The utility is available to it; the terminal has no scrolling
  chrome today, and a touch surface has different scrollbar ergonomics than a mouse one. Whoever
  gives the terminal its first scroller decides, and the utility is there.
- **No hover or active treatment.** The thumb does not darken on hover. Adding one means the
  `-webkit-` tree, which the first paragraph rejected.
- **No scrollbar gutter reservation.** Content still shifts by the thumb's width when a region
  becomes scrollable. If that shift is ever visible enough to matter, `scrollbar-gutter: stable`
  is the fix and it belongs in the same utility.

## What would make this decision wrong

- **A browser in use renders `scrollbar-width: thin` too thin to grab.** It is the platform's own
  thin metric, not a pixel this repository chose, so the failure would be a platform one — but the
  remedy is still ours, and it would be the `-webkit-` tree with a named width.
- **`--color-accent` gets re-roled** by a later palette decision. The thumb follows it silently,
  which is correct until the day accent stops meaning "quiet surface tint". Named here so that day
  finds this record.
- **A later area needs a differently-styled scroller** — a dark panel, say, where a `#e4e4df` thumb
  disappears. The utility is one line; a variant of it is the answer, not an override in app code.

## Evidence

- Human's reference crop, 2026-08-02: slim rounded thumb, no track fill, no track border.
- `packages/ui/src/theme.css:71` — `tap-target`, the existing `@utility` precedent this follows.
- `packages/ui/src/theme.css:38` — `--color-accent: #e4e4df`, reused rather than re-specified.
- `.scratch/decisions/019` — the rule that put this in `packages/ui` instead of `AppShell`.
- Verified live at 1280×600, where the sidebar overflows: thumb only, no track, no border.
