# ADR-0013: The reference design set is adopted as skin and parts, not as screens; its palette is re-roled to meet AA

- **Status:** accepted
- **Date:** 2026-08-02
- **Decided by:** human supplied a Shopify-POS reference set (style guide, dashboard, orders,
  process-orders frames) and asked that DeanPOS adhere to it. This is what "adhere" was
  resolved to mean, and why the palette does not survive contact with the contrast test intact.

## Context

The reference set carries three separable layers, and they do not cost the same to adopt.

1. **Skin** — Manrope, `#35CCA6` / `#E14A77` / `#FFFFFF` / `#1E1E1E`, an 8px spacing grid, a
   1320px 12-column desktop grid, pill radii, light and dark modes.
2. **Parts** — sidebar with an active pill, stat tiles with tinted icon squares, status badges,
   filter strips, sortable tables, card surfaces.
3. **Screens** — the reference's own information architecture: Dashboard, Inventory, Purchases,
   Sales Orders, Banking, Finance.

Layer 3 collides with `design/lofi/`. Those mocks are the screen contract, and the notes under
them carry rules the drawings cannot: the blind cash count, the expected total withheld from
the cashier who counts, discount and VAT surfaces that do not render at all for tenants without
them, `tables` and `tickets` as one route in two configurations. The reference set is a generic
ecommerce admin and knows none of it.

Layers 1 and 2 collide with nothing. `design/lofi/README.md` already declines to specify colour,
type scale, spacing, and radii, and points at `packages/ui` for them.

## Decision

**Adopt layers 1 and 2. Screens continue to come from the PRDs and `design/lofi/`.**

### The palette is re-roled, because the style guide's roles fail AA

Measured against `packages/ui/tests/contrast.test.ts`:

| Pair | Ratio | AA text (4.5:1) |
| --- | --- | --- |
| white on `#35CCA6` | 2.03:1 | fails |
| `#1E1E1E` on `#35CCA6` | 8.2:1 | passes |
| white on `#E14A77` | 3.86:1 | fails |
| `#1E1E1E` on `#E14A77` | 4.32:1 | fails |
| `#000000` on `#E14A77` | 5.45:1 | passes |

`#E14A77` fails with white and with this palette's near-black. Pure `#000000` on it does pass at
5.45:1 — so the prohibition is a **policy**, not an arithmetic impossibility, and it is stated
that way deliberately. Buying a legible pink button would cost a second, blacker foreground token
existing only to sit on one accent, and the reference frames never ask for one. A brand colour
that needs its own private foreground to hold a label is not an action colour.

The reference frames already agree with the arithmetic, which is the part worth recording: every
pressable element in them is **black**. The `Process All` button, the active sidebar pill, the
`Get Started` button. Green appears in charts, in the accuracy gauge, and in status pills. Pink
appears in the gauge and as status dots. The accents are never asked to carry a label.

So:

- **`#1E1E1E` is the action colour.** Primary buttons, active nav, focus ring.
- **`#35CCA6`, `#E14A77`, and the amber and blue seen in the reference's tile row are status and
  data-visualisation accents only** — a dot, a chart series, or a saturated icon on a pale tint
  of itself. They never sit under text.
- **Destructive gets its own red, roughly `#C0264F`** — the brand pink's darker sibling, dark
  enough to hold white text. Void and refund are the two controls in this product where a
  mistaken tap costs money, and they do not get an unreadable button.

### Two densities, one skin

The reference is a seated, mouse-driven desktop admin. `apps/pos` is a counter tablet tapped at
speed. `packages/ui` already encodes the split — `--min-target-size: 24px` against
`--min-touch-size: 44px`.

Back-office and landing take the reference's compact spacing — though **`apps/landing` is not wired
up by this work.** It is a Next.js app with no dependency on `ui` and no import of `theme.css`, and
its `src/app/page.tsx` is a stub rather than a designed screen. Wiring a marketing site to a token
layer before it has content is speculative, so area 11 inherits the obligation, named here so it is
not rediscovered: the landing site adopts this font, palette, and compact scale, and comes under the
same design-value guard.

The terminal takes a touch-scaled version of the **same** tokens — larger type, taller rows, 44px floor on anything tappable. One
system with two scales, not two design systems.

### Light only, for now

Colour tokens are named by their job, never by their value, which is what makes a dark set a
later addition of values rather than a refactor. Dark mode is deferred, and with it the question
it drags in: the back office's theme belongs to a **User**, but a shared terminal unlocked by PIN
would flip colour under each cashier mid-service, so there it would have to belong to the
**Device**. Two ownership rules for one feature, and no reason to answer that today.

Note for whoever adds it: `contrast.test.ts` reads `--color-*` declarations into a flat map. A
second block reusing the same names overwrites the first and the test goes green while light mode
goes unchecked. Dark mode requires that test to be restructured, not just extended.

### Components are pulled, never authored

`shadcn` 4.16.1 and `components.json` are already in `packages/ui`; `button` and `sheet` came from
them. Every new part is pulled with the CLI and then re-skinned. `shadcn add` injects its own
colour tokens into `theme.css` on the way in — that diff is reviewed and reverted every time, or
the contrast test starts failing for reasons nobody chose.

Five parts are in scope now, because `design/lofi/` proves each one recurs: the shell sidebar,
card, badge, table, and the filter strip composed from `tabs`/`select`/`input`. Stat tiles, the
accuracy gauge, and the `⌘+Space` palette are **not** — no mock asks for them, and the last of
those three is Spotlight on macOS and meaningless on a keyboardless tablet.

`.scratch/decisions/007` lists `card`, `table`, `badge`, `tabs`, `select`, `input` under "later
areas". This pulls them earlier. It does not overturn 007; 007's list was scoped to what issues 06
and 07 needed.

### Record 007's import ban is upheld, at a price

> No file under `packages/ui/` may import from `contract`, `schemas`, `backend`, `@orpc/*`, or
> `@tanstack/*`.

shadcn's sortable data table **is** `@tanstack/react-table`; the `table` it ships via the CLI is
styled markup with no sorting. So `packages/ui` gets the dumb table, and each app builds sorting
on top with TanStack Table. The rule was made greppable on purpose and is worth more than the
duplication it costs.

## Consequences

- The work lands as new issues appended to `foundation`, and it **blocks area 2**. Every screen
  in areas 2–12 is unbuilt; theming now means nothing is skinned twice.
- Issue `05-ui-tokens-and-primitives` is merged and stays merged. This supersedes its output
  rather than editing its record.
- `.scratch/foundation/reference/` needs no re-capture — those frames are copies of the greyscale
  lo-fi SVGs, and a skin change cannot invalidate them. What it does need is the reference set
  itself committed, and its `README.md` amended: "judge never spacing or proportion" was correct
  when lo-fi was the only authority, and is now wrong. Spacing and colour became judgeable the
  moment they had a source — against the tokens and the reference set, never against a lo-fi SVG.
- `docs/agents/code-standards.md` gains a styling section — tokens only, no raw hex, no arbitrary
  values, use the shared part where one exists — plus a test that fails on raw hex and arbitrary
  values in app code. The screens here are written by pipeline agents; an unwritten convention is
  one no implementer was ever told.
- Manrope is self-hosted as a single variable file. It carries `tnum`, so money columns, receipts,
  and cash counts align. A CDN font would leave the offline terminal (ADR-0003) rendering in a
  fallback face.
- No screen will match a reference frame pixel for pixel. That is the decision, not a shortfall
  in executing it.

## Reversing it

The skin is cheap to revisit — semantic token names mean a palette swap is a values edit. The
parts are moderate. The rejected layer 3 is the expensive one: taking the reference's IA later
would mean regenerating `tools/lofi/screens_*.py`, discarding ~30 mocks, and re-deriving by hand
the domain rules currently written under them.

**Trigger to revisit the palette roles:** a WCAG-conformant way to put a label on `#35CCA6` or
`#E14A77` — a brand-approved darker tint would qualify. Wanting a green button does not.
