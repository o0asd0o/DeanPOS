# Lo-fi mocks

`ORC2_DESIGN="lofi"`, `ORC2_LOFI_DIR="design/lofi"`. These SVGs are the visual contract
for every screen-fidelity issue. Read `.claude/skills/lofi-to-code/SKILL.md` before
building from one.

**A mock fixes what is on the screen and in what order. Nothing else.** Spacing, type
scale, colour, radii, and every interaction state come from `packages/ui` tokens and from
the nearest existing screen — never from measuring these files. They are deliberately
greyscale and deliberately ugly so that measuring them is obviously wrong.

Each mock carries **notes under the frame**. Those notes are part of the contract: they say
what the drawing cannot, and several of them are the whole reason a screen exists (the
blind count, the withheld expected total, "publish means visible, not delivered").

## Regenerating

```
python3 tools/lofi/generate.py
```

Screens are defined in `tools/lofi/screens_{pos,backoffice,landing}.py`. Edit, re-run,
commit the SVGs. The SVGs are what the pipeline reads; the script is how they stay
consistent.

## Widths

| Surface | Widths drawn |
| --- | --- |
| POS terminal | `1280` tablet landscape, `390` phone. **Two designs, not one breakpoint.** |
| Back-office | `1440` desktop; `390` for the two screens a manager actually opens on a phone |
| Landing | `1440`, `390` |

A width that is not drawn is your translation and **must be flagged as such in the build
report**, not quietly invented.

## Visual reference entries

Copy these verbatim into an issue's `## Visual reference` section.

### POS — `checkout`

```
- Image · whole-screen · 1280: `design/lofi/pos/sale-grid-1280.svg`
- Image · whole-screen · 390:  `design/lofi/pos/sale-grid-390.svg`
- Image · whole-screen · 1280: `design/lofi/pos/variant-grid-1280.svg`
- Image · whole-screen · 390:  `design/lofi/pos/variant-grid-390.svg`
- Image · whole-screen · 390:  `design/lofi/pos/cart-390.svg`
- Image · component: ModifierAddonModal · 1280: `design/lofi/pos/modifier-picker-1280.svg`
- Image · component: ModifierAddonModal · 390:  `design/lofi/pos/modifier-picker-390.svg`
- Image · whole-screen · 1280: `design/lofi/pos/payment-1280.svg`
- Image · whole-screen · 390:  `design/lofi/pos/payment-390.svg`
- Image · component: DiscountPicker · 1280: `design/lofi/pos/discount-picker-1280.svg`
- Image · whole-screen · 1280: `design/lofi/pos/receipt-1280.svg`
- Image · whole-screen · 390:  `design/lofi/pos/receipt-390.svg`
- Image · component: ManagerOverrideDialog · 1280: `design/lofi/pos/manager-override-1280.svg`
- Image · whole-screen · 1280: `design/lofi/pos/order-lookup-1280.svg`
```

`discount-picker` and the discount/VAT lines on `payment` and `receipt` are **conditional
surfaces**. A tenant with no Discounts configured has no discount control anywhere, and a
non-VAT tenant has no VAT line anywhere — that absence is the default configuration, not an
edge case, and it needs its own build check.

### POS — `tenancy-identity`

```
- Image · whole-screen · 1280: `design/lofi/pos/pin-unlock-1280.svg`
- Image · whole-screen · 390:  `design/lofi/pos/pin-unlock-390.svg`
- Image · whole-screen · 1280: `design/lofi/pos/device-enrolment-1280.svg`
```

### POS — `offline-sync`

```
- Image · whole-screen · 1280: `design/lofi/pos/sync-status-1280.svg`
- Image · whole-screen · 390:  `design/lofi/pos/sync-status-390.svg`
```

### POS — `drawer-sessions`

```
- Image · whole-screen · 1280: `design/lofi/pos/drawer-open-1280.svg`
- Image · whole-screen · 1280: `design/lofi/pos/drawer-close-1280.svg`
- Image · whole-screen · 390:  `design/lofi/pos/drawer-close-390.svg`
- Image · whole-screen · 1280: `design/lofi/pos/running-summary-1280.svg`
- Image · whole-screen · 1280: `design/lofi/pos/session-history-1280.svg`
```

`running-summary` draws **two right-hand panels that are the same screen for two people** —
with and without the right to see expected cash. It is not a two-panel layout. Building it
as one is the way the blind count gets defeated.

### Back-office

```
tenancy-identity  design/lofi/backoffice/login-1440.svg
                  design/lofi/backoffice/devices-1440.svg
                  design/lofi/backoffice/users-1440.svg
                  design/lofi/backoffice/settings-sales-1440.svg
catalog           design/lofi/backoffice/catalog-list-1440.svg
                  design/lofi/backoffice/menuitem-editor-1440.svg
                  design/lofi/backoffice/addons-1440.svg
                  design/lofi/backoffice/availability-1440.svg
                  design/lofi/backoffice/discounts-1440.svg
drawer-sessions   design/lofi/backoffice/drawer-sessions-1440.svg
reporting         design/lofi/backoffice/reports-summary-1440.svg
                  design/lofi/backoffice/reports-summary-390.svg
                  design/lofi/backoffice/reports-orders-1440.svg
                  design/lofi/backoffice/reports-by-item-1440.svg
hardening         design/lofi/backoffice/quarantine-1440.svg
workforce         design/lofi/backoffice/roster-1440.svg
                  design/lofi/backoffice/roster-mine-390.svg
```

The back-office shell — sidebar, tenant switcher, top bar — is drawn on every back-office
mock. It is built once in `foundation` and every later screen inherits it.

**`Reports` is a nav group, not a leaf.** Its eight children are the sales reports, and
`Summary` is also the back-office landing page — there is no separate dashboard route.
Only four of the eight are drawn; `By category`, `By cashier`, `By payment method`, and
`Discounts & overrides` are the same filter-strip-plus-table shape as
`reports-by-item-1440` and are that mock's translation. **Flag them as translated in the
build report** rather than treating them as drawn.

`By payment method` does not render at all for a cash-only tenant, and the discount columns
and the VAT tile do not render for a tenant without them. Every back-office report mock is
drawn in its *fully configured* state; the default tenant sees less.

### Landing

```
- Image · whole-screen · 1440: `design/lofi/landing/home-1440.svg`
- Image · whole-screen · 390:  `design/lofi/landing/home-390.svg`
- Image · whole-screen · 1440: `design/lofi/landing/pricing-1440.svg`
```

## Not drawn, on purpose

These are gaps the mocks do not fill, and per the skill they go to the `decider` rather
than being invented by an implementer:

- Empty states — a Store with no menu, a day with no sales, an empty roster week.
- Loading and skeleton states.
- Every error state except the few drawn as dashed strips.
- Focus, hover, disabled, and pressed treatments.
- The back-office at widths between 390 and 1440.
- The landing site's imagery — the screenshot slots are placeholders.
- Anything about motion.
