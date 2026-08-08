---
name: page-revival
description: Revive an existing screen, route, list, or dashboard — audit its filters and controls against the page's real data dimensions and its one operational question, rebuild the list layer (controls, filtering, URL state, shared components), then run the frontend-design pass for the look. Use when the user asks to improve, revive, redesign, polish, or level up an existing page — especially table-heavy back-office screens. Not for building new pages from scratch — that is the plan/build skills' job, not a revival.
---

# Page revival

Reviving a page is two layers, and they are done in order:

1. **Structure** — what is on the screen and why. Which filters exist, which are useless, which are missing, and how the page's state survives navigation. This skill owns that layer.
2. **Look** — how it feels. That pass is **`/skill:frontend-design`**: load it and follow it once the structure is rebuilt. This skill never invents a visual direction; it hands frontend-design a screen whose structure is already right, so its boldness has somewhere to land.

The worked example throughout is the Devices screen revival (`/devices`): its status filter answered "is this device revoked?" when the page's real job was "which tills need attention right now?" — a binary lifecycle filter nobody needed, sitting on top of a table that already computed the useful signal and never exposed it.

## 1. Name the page's one job before touching anything

Write one sentence answering: what is the operational question this page answers for the person reading it?

- Devices: "which tills are down or stale right now?" — not "which devices are revoked?"
- A stores list: "where are we live?" — not "which store is deactivated?"

If the page has no clear one-job answer, that is the finding, not the controls. Say so and stop before redesigning anything.

## 2. Audit what is on top of the table

For every existing control (pills, selects, search, dropdowns), ask two questions:

- **What question does it answer?** A binary status filter ("Active / Revoked") that duplicates a column badge and a column sort is not a filter — it is the default view wearing a control's clothes. It earns its keep only when one of its two states is a state the reader actually hunts for.
- **What dimension is it ignoring?** The data almost always has more than the stored booleans. Enumerate the real dimensions of the row type:

| Dimension | Example (Devices) | Control it earns |
| --- | --- | --- |
| A **computed signal** the table already renders (a health dot, a staleness, a utilization) | `lastSeenAt` → green/amber/grey thresholds | Pills over the live signal |
| A **high-cardinality enumeration** with names | Store (Malabon, Cubao) | Select |
| A **stored lifecycle boolean** | revoked vs not | Nothing — it is already a column + sort |
| **Free text** (names, codes) | device name + short code | Search, broadened to related entities |

The classic miss: the table computes a signal (the dot in Last seen) but the toolbar filters on a stored boolean (Status). The signal is the operational answer; the boolean is an audit detail.

## 3. Design controls from the data, not from the existing UI

- **Pills over the live signal.** Replace the binary status pills with the computed signal's states ("Online / Stale / Offline"), derived from the same thresholds as the table's dot. A lifecycle edge (revoked) folds into the grey end of the signal — it reads Offline, it does not get its own pill.
- **One select per high-cardinality dimension**, next to the pills, labelled like the pill group. Only when it earns it — see conditional rendering.
- **Counts live in the page subtitle, not on the pills.** "12 devices · 8 active" is a summary; pill counts are noise. If the page header already counts, do not duplicate.
- **Conditional render is a feature, not a shortcut.** A dimension with one value filters nothing — hide its control entirely (`storeNameById.size > 1 && …`). A single-store tenant must not see a Store select.
- **Broaden the search** to the related entities a person would type: store name, assigned user, code — not just the row's own name.
- **Empty-state copy follows the filters**: "No devices match these filters — try another filter, or clear the search." It tells the reader the filters are the cause.

## 4. Implement — this repo's playbook

- **Never fork the shared toolbar per page.** Extend the shared component (`components/ListToolbar.tsx`) with a variant (health vs status pills) and a `children` slot for the extra control. Seven list cards share it; a fork is seven copies of the same bug.
- **Filters ride the URL**, so a filtered view survives a trip to a row's editor and a shared link lands on the same fleet:
  - The route owns parsing: `validateSearch` on the route file, with per-field parsers that fall back to defaults on anything absent or malformed (`parseHealth` whitelists values; `parseQuery` clamps length). Route files stay thin — this is params, which is exactly the route layer's job.
  - The feature reads `useSearch({ from: "/_shell/<route>" })` (string route id — never import the route file into a feature) and writes through `useNavigate()` with `replace: true` so back/forward stays clear of every keystroke.
  - **Gotcha 1 — `from` vs `to`.** A search-only navigate scoped to `useNavigate({ from })` resolves the destination against the route *id* as if it were a path and lands on NotFound. Use `navigate({ to: "/<path>", search: … })` with the path.
  - **Gotcha 2 — the search type wants the full object.** The navigate search type is the route's validated shape; spreading `prev` leaves optional keys and fails the typecheck. Build the object from the current `useSearch` values: `search: { health, store, q }`.
- **A live signal needs live data.** A "Stale / Offline" filter is only as honest as the list underneath it — poll the query (`refetchInterval: 60_000`) at a rate comfortably below the signal's granularity (5-minute thresholds). Each query observer runs its own timer, so a faster poll elsewhere (an enrolment watch at 3s) is unaffected.
- **Keep the lifecycle column.** The Status column (Active / Revoked badge) stays; the pills filter health, the column shows lifecycle. Two different questions, two different surfaces.

## 5. The design pass — chain `/skill:frontend-design`

Load it and follow it for the visual layer. This skill's output is its input: a screen whose controls, hierarchy, and URL behaviour are settled. Keep the division:

- This skill decides what is on the screen and why.
- frontend-design decides palette, type, spacing, and the one signature element.
- The toolbar is structure, not decoration — frontend-design's restraint rule applies hardest there.

## 6. Prove it

Screen tests, through the repo's seam (`renderRoute`), one test per new behaviour:

- The filter actually filters (seed rows at each signal state; click each pill; assert rows).
- Conditional visibility (one store → no Store control; two stores → it appears and filters).
- URL round-trip (the choice lands in `?health=offline`; a fresh render at that URL lands on the same fleet).
- Search broadened to related entities (store name, assignee).

Watch for the two classic test traps: a control that depends on a second query settling *after* the row it filters (wrap its assertions in `waitFor`), and fixtures that leave the DB dirty enough to push rows past the page size (wipe the entity set in a `beforeAll`, FK order: audit → codes → parent).

## The revival checklist

- [ ] One operational question named, in writing
- [ ] Every kept control answers a real question
- [ ] No control duplicates a column, badge, or sort
- [ ] The computed signal the table already shows is exposed as a filter
- [ ] Controls persist to the URL and survive navigation
- [ ] Single-value dimensions render no control
- [ ] Search covers related entity names
- [ ] Counts live in the subtitle, not on the pills
- [ ] Lifecycle stays visible alongside the live signal
- [ ] `/skill:frontend-design` ran on the rebuilt structure
- [ ] Tests green, URL round-trip asserted
