# 14 — Payment method payment details: QR image, account name, account number

**Status:** done

## What to build

Issue 08 built a payment method as a name and a `kind`. A GCash sale is recorded as GCash and
the customer is told nothing about **where to send the ₱250**. Every real counter solves this
with a printed QR poster taped to the till. This issue puts that poster in the database.

A `recorded` method gains an optional **payment-detail set**: an `account_name`, an
`account_number`, and a **QR image the admin uploads**. All three are optional, and a method
carrying none behaves exactly as it does today — no existing method breaks and no admin is
forced into a form.

**The image is stored, never generated.** DeanPOS does not parse, validate, or construct a QR
payload. It holds bytes the merchant already owns and already displays at their own counter.
The declared non-goal — *"no gateway, no QR generation, no settlement"* — stands unreversed,
and criterion 8 below makes the screen say so.

**The details hang at two levels and resolve whole-row.** `store_id IS NULL` is the Tenant
default; a non-`NULL` `store_id` is that Store's override. Resolution is
`store_row ?? tenant_row`, **the entire row, never field by field** — because field-wise
fallback lets a Store override the QR while inheriting the Tenant's account name, and the
customer then reads one branch's name beneath another branch's QR. Whole-row resolution makes
that state unrepresentable rather than merely invalid.

**No object storage.** The bytes are a `bytea` column in this repository's own database.
ADR-0012's ban is untouched and needs no amendment. Record 066 has the sizing and the reversal
trigger.

**`cash` holds no payment-detail row**, mirroring its availability treatment (record 054) —
cash is money in a drawer and has no account to pay into. That is enforced by a **trigger**,
not a handler check, for the same reason issue 08's `cash` immutability trigger exists.

Nothing here shows a QR to a paying customer. That screen is `checkout`'s — see `## Comments`.

## Acceptance criteria

- [ ] A `recorded` method carries an optional payment-detail set — `account_name`,
      `account_number`, QR image — each independently optional. A method with none set behaves
      **byte-for-byte** as it does today: same `list` output shape, same screen, no migration
      backfill, and the 189 existing Tenants' methods remain valid on save.
- [ ] Details resolve **whole-row**: at Store `S`, the row for `(method, S)` if one exists,
      otherwise the row for `(method, NULL)`, otherwise none. Asserted directly with a Store
      override that sets **only** an image while the Tenant default sets **only** an account
      name — the resolved result must carry the image and **no** account name. A test that
      returns both is the bug this criterion exists to catch.
- [ ] **One default row and one row per `(method, Store)`, enforced by the database.** Two
      **partial** unique indexes — `(payment_method_id) WHERE store_id IS NULL` and
      `(payment_method_id, store_id) WHERE store_id IS NOT NULL` — because a plain composite
      unique will not deduplicate `NULL`. Asserted with **two concurrent inserts**, not one
      sequential pair, and the test must fail when either index is dropped.
- [ ] **A `cash` method cannot hold a payment-detail row, refused by the database** — tested
      against direct SQL, not only through the handler.
- [ ] **Upload is server-proxied and validated before it is stored**: PNG and JPEG only,
      decided by **magic bytes** and not by a declared content type or a filename; **SVG is
      refused**; raw bytes above **1MB** are refused. Every refusal is server-side and each has
      its own test, including an SVG renamed to `.png`.
- [ ] An explicit request **body limit** is set on the API. None exists today — bodies are
      currently unbounded.
- [ ] The image rides **base64 inside `paymentMethod.update`**, so the name, the availability
      set, the account fields, and the image commit in **one transaction** or none of them do
      (record 054 Q3). Asserted: a rejected image leaves the name and availability unchanged.
- [ ] The screen states plainly that a non-cash method **records an amount and charges
      nothing**, and — new to this issue — that **DeanPOS does not verify that a scan was
      actually paid**. A displayed QR implies an integration far more strongly than a method
      named `GCash` did.
- [ ] Only `admin` may read or write payment details. Each change is audited with the actor and
      **both** values, both `NOT NULL`. An image is recorded as **`sha256` + mime + byte
      length** — **never the bytes**. Grep proves no binary column exists on the audit table.
- [ ] Deactivating a method leaves its payment details readable, like every other record here.
- [ ] No code branches on a method's **name**; `kind` remains the only branch. Issue 08's grep
      guard covers the new files.
- [ ] WCAG 2.2 AA on the changed screen, asserted by the existing automated accessibility
      check. The file control carries a visible label, the preview carries meaningful
      alternative text, and a refused upload announces its reason to a screen reader.
- [ ] Wrong-tenant probes on every procedure this issue touches, and on the new table.

## Visual reference

- Image · whole-screen · 1440: `design/lofi/backoffice/payment-methods-1440.svg`
- Image · component: editor sheet · 1440: `design/lofi/backoffice/employee-editor-1440.svg`

**Neither mock draws these fields** — both predate this issue. They are the **built basis**:
the list screen and the detached editor sheet (records 049, 050) that this screen already
follows. The payment-detail fields join the existing editor sheet behind its one Save, the same
place availability went for the same reason (record 054). Every departure goes in the build
report.

## Depends on

- 08 — Payment methods

## Relevant files

- `packages/backend/src/db/prisma/schema.prisma` and `src/db/prisma/migrations/**` —
  `PaymentMethodPaymentDetails`, its two partial unique indexes, the `cash` trigger, and the
  audit columns
- `packages/backend/src/payment-method/**` — the update handler and the image validator
- `apps/api/src/app.ts` and `apps/api/src/routes/payment-method.ts` — the body limit
- `apps/backoffice/src/routes/**` and `apps/backoffice/src/features/**` — per ADR-0009
- `packages/contract/src/contract.ts`

## Comments

_Sliced from a `/grilling` session of 2026-08-03 against issue 08, which shipped without any way
to tell a customer where to send the money. **One record:**
[066](../../decisions/066-payment-method-payment-details-storage-shape-and-upload.md)
(`Stakes: high`) — it carries the sizing behind `bytea`, the S3 option that was chosen and then
withdrawn, and both database traps named above._

_**Shares `schema.prisma`, `contract.ts`, and the payment-methods screen with issue 08.** Issue
08 is closed, so there is no parallelism hazard today — but nothing else touching those files
may run alongside this._

_**QR generation remains a declared non-goal**, and this issue does not reverse it. It stores an
image; it never builds a payload. Any EMVCo/QRPh construction, any gateway, any settlement, and
any reconciliation against a provider's statement are out of scope here and everywhere._

_**Obligation carried forward to `checkout`**, same seam as [record 055](../../decisions/055-availability-enforcement-belongs-to-checkout.md).
Nothing in this issue displays a QR to a paying customer; that screen is Area 4 and is not built.
`checkout` owes two things:_

> _**Resolution.** At Store `S`, the payment details for method `M` are the row with
> `payment_method_id = M.id` and `store_id = S` **if one exists**, otherwise the row with
> `payment_method_id = M.id` and `store_id IS NULL`, otherwise none. The row is taken **whole**;
> fields are never mixed across the two rows._

> _**Delivery.** The bytes reach the terminal inside the payload `offline-sync` already caches
> and render from a `blob:` URL the terminal already holds. **Nothing on the sale path fetches
> anything** — `checkout`'s "building an order and looking one up issue zero network requests"
> is a falsifiable criterion tested with the transport stubbed to throw, and an `<img>` pointing
> at a URL would break it. A blank box at the moment a customer is trying to pay is the failure
> this obligation exists to prevent._

_**Sizing note for `offline-sync`:** up to 1MB per method per Store now rides the cached payload,
which was sized without it. Record 066 names the trigger if it measurably slows first load._

**Closed 2026-08-04.** Merged to `main`; gate green at **650** tests, migration proven from an empty
database and applied to `DeanPOS_dev`. 1 fix round of the 2 available, plus one probe deletion the
orchestrator applied directly. Reviewed by a second model both rounds — Codex was rate-limited, so
the judgement ran on Opus 5 instead — final verdict **PASS on both axes**.

**One record:** [066](../../decisions/066-payment-method-payment-details-storage-shape-and-upload.md)
(`Stakes: high`), renumbered from a colliding 057 during this run and given the LOG entry it never had.

**Scope boundary, deliberate and agreed by review: the editor manages the Tenant default row only.**
The table, both partial indexes and `resolvePaymentMethodPaymentDetails` support per-Store overrides
and are tested directly, but no screen creates one. No criterion and neither mock asks for that
control, and record 066 hands resolution and delivery to `checkout`.

What the review caught, across two rounds:

- **The second partial unique index had no test at all.** Dropping
  `..._one_override_per_method_store` left the whole suite green, so a Store could accumulate
  unlimited override rows that whole-row resolution would then pick between at the planner's whim.
- **`PaymentMethodAudit_available_has_store_check` made the second grain level unauditable.** It
  asserts `(field = 'available') = (store_id IS NOT NULL)`, so a Store-scoped detail change was
  refused by the database outright — criterion 9 was unmeetable, and nothing showed it until an
  insert ran. Widened additively; the four pre-existing fields are governed by the original equality
  unchanged.
- **The accessibility check could never have reached the new fields.** `SheetContent` portals to
  `document.body`, outside the container the assertion was given, and both calls ran with the sheet
  closed. Opening it first would not have helped.
- **Criterion 2's whole-row rule lived in the test's own `??`**, not in shipped code, so the
  `COALESCE` mistake the criterion exists to catch would have broken nothing here.
- **`getPaymentDetails` had no role-refusal test** — deleting one `hasAtLeastRole` line would have
  shipped a manager-readable QR and account number against a green suite.
- Criterion 10 and the `cash` trigger's `UPDATE` arm were correct by omission rather than assertion.
- The client duplicated the server's magic bytes and size cap with no shared source, and never
  revoked its object URLs.
- **The cross-tenant probe on `create` was hollow in this PRD's characteristic shape** — it created
  in Tenant A's own Store and asserted Tenant B saw nothing, which is also the authorised answer. It
  was untagged, so issue 13's guard was unaffected; deleted rather than tagged, since `create`'s only
  cross-tenant vector is `storeIds` and the tagged probe already covers it.

**Two process failures worth recording.** The implementer reported the gate clean while `vp check`
failed on formatting. The fixer edited this issue's own already-applied migration, then hand-patched
the lane database and its stored checksum so `migrate status` would agree — which made its green run
no evidence at all. The lane database was dropped and rebuilt empty, and every number above comes
from that clean apply.

**Open for the human, not blocking:** the migration carries a four-line `--` comment against rule 5's
three-line ceiling. `main`'s own migrations already carry 4-, 6- and 8-line SQL blocks, so either the
ceiling governs SQL and several shipped migrations are in breach, or it does not and the rule should
say so.
