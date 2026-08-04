# 066: Payment details are a `bytea` row keyed by `(method, Store-or-NULL)`, resolved whole-row, uploaded as base64 through the existing Save, and audited as a hash

- **Status:** decided
- **Stakes:** high — a new table on the money-adjacent path, an image displayed to a paying customer, an append-only audit that can never be corrected, and a storage choice that was reversed once during the session
- **Date:** 2026-08-03
- **Asked by:** the human, in a `/grilling` session on `.scratch/tenancy-identity/issues/08-payment-methods.md`, which shipped without any way to tell a customer where to send the money
- **Relates to:** [054](054-payment-method-availability-and-its-audit.md) (`cash` holds no rows; audit shape; one form, one Save, one transaction); [055](055-availability-enforcement-belongs-to-checkout.md) (the carry-forward precedent this copies); [046](046-how-tenant-settings-are-stored-and-audited.md) §3 (both values, `NOT NULL`); ADR-0012 (object storage — **not amended**, see below)

## The questions

Issue 08 built a payment method as a name and a `kind`. A GCash sale is recorded as GCash, and
the customer is told nothing about where to send the ₱250. Every real counter solves this with a
printed QR poster taped to the till.

Seven questions, resolved in order: **Q1** is a QR here a generated payload or an uploaded
image. **Q2** at what grain the details hang. **Q3** where the bytes live. **Q4** how a Store's
override composes with the Tenant default. **Q5** which fields are required. **Q6** what an
append-only audit stores for an image. **Q7** how the bytes arrive at Save.

A wrong answer costs four ways: a declared non-goal reversed by accident; a customer shown the
Makati branch's QR under the Cubao branch's account name; a permanent, uncorrectable copy of
every image ever uploaded in an append-only table; and a blank box on the screen at the exact
moment a customer is trying to pay.

**No weighted scoring table appears below.** The other records in this directory carry one
because an agent decided them. A human decided every question here directly, and inventing
weights after the fact would be manufacturing evidence for a decision that did not use it.

## What was chosen, and why

### Q1 — A static merchant image, not a generated payload

The admin uploads the merchant's own GCash or Maya QR once. DeanPOS stores bytes and displays
them. **It never parses, validates, or generates a QR payload.**

This is what keeps the declared non-goal intact rather than reversed. *"No gateway, no QR
generation, no settlement"* appears in three documents — `.scratch/tenancy-identity/PRD.md:510`,
`.scratch/checkout/PRD.md:750`, `.scratch/APP-PLAN.md:23` — and every one of them is banning the
same thing: DeanPOS constructing a payment instruction and implying it is good. Displaying a
poster the merchant already owns and already tapes to their counter constructs nothing.

The alternative — building an EMVCo/QRPh payload from an account number and the sale amount —
was refused. It reverses three documents, requires QRPh spec compliance, and makes DeanPOS the
party that vouches the payload is correct. A malformed payload is a customer's money sent
somewhere else.

### Q2/Q4 — Tenant default plus per-Store override, resolved whole-row

One table. `store_id IS NULL` is the Tenant default; a non-`NULL` `store_id` is that Store's
override. Resolution is `store_row ?? tenant_row`, **the entire row**, never field by field.

Field-wise `COALESCE` was refused, and this is the sharpest decision in the record. It lets a
Store override the QR image while inheriting the Tenant's `account_name`, and the customer then
reads *"Juan Dela Cruz"* printed beneath a QR that pays into a different branch's account. Wrong
name over right money, or right name over wrong money. Whole-row resolution makes that state
**unrepresentable** rather than merely invalid — no validation rule to write and no validation
rule for a later change to forget.

Tenant-wide-only was refused because a multi-outlet or franchise tenant runs a different account
per branch, and discovering that after 189 tenants have rows is a backfill with no correct answer.

### Q3 — `bytea`, in this repository's own database. No bucket.

**Chosen after being reversed.** S3 was chosen first and then withdrawn, on one fact that only
became visible after Q7 and the offline question were answered: with a server-proxied upload and
with bytes riding the sync payload, **no client ever talks to the bucket**. The API would write
the object and the API would read it back to build the payload. Object storage reduced to an
origin store the server round-trips through.

At that point the bucket's entire remaining benefit is *keeping binary out of `pg_dump`*, and it
charges: an ADR-0012 amendment, a fifth Compose service, **a 455-test gate that stops being
Postgres-only**, `S3_*` credentials in every environment, a second backup target and lifecycle
policy for `release-ops`, and a two-phase write where a committed row with a failed `PutObject`
— or the reverse — is a state someone has to handle.

The sizing makes the trade plain. A GCash poster is 100–800KB. A typical tenant is two methods
at one Store, ~400KB. **189 tenants ≈ 75MB.** Postgres TOASTs the blob out-of-line
automatically, so the hot row stays thin with no special handling, and the image and the account
fields commit in one transaction — which is what Q4's atomicity already required.

**ADR-0012 is therefore untouched and needs no amendment.** Its sentence — *"no bucket, and no
object storage in v1"* — remains literally true. An earlier draft of this session wrote an ADR
narrowing it; that ADR was deleted, because narrowing a decision you turn out not to need is how
a decision record stops being load-bearing.

### Q5 — All three fields optional

`account_name`, `account_number`, and the image are each optional, and a method carrying none
behaves exactly as it does today. Present fields display; both a QR and an account pair together
is the normal case at a real GCash counter, not a contradiction to resolve.

An XOR constraint was refused: it forbids the common case. A required-at-least-one rule was
refused: it invalidates every method the 189 existing Tenants already have, on their next save,
for a field they never agreed to fill.

### Q6 — The audit stores a SHA-256, never the bytes

`PaymentMethodAudit` is append-only with both values `NOT NULL` (record 046 §3, criterion 7).
An image change records `sha256`, `mime`, and byte length for the old and the new value.

Storing the bytes was refused twice over: the table grows without bound, and an append-only row
can never be corrected, so it becomes a permanent copy of every image ever uploaded that no
deletion request could ever honour. A hash proves which image was in effect and stays true after
the image is replaced.

With no bucket there is no object key to store, and no orphaned object to sweep — replacing an
image is an ordinary `UPDATE` and the two hashes are the whole history.

### Q7 — Base64 inside the existing `paymentMethod.update`

Record 054 Q3 established *"one form, one Save, one transaction"* for this screen and it holds
here: the name, the availability set, the account fields, and the image all commit together or
none of them do. A separate upload route returning a handle would split the save in two and
leave a dangling upload whenever an admin cancels.

The cost is 33% base64 inflation against a **1MB raw cap** — a ~1.4MB request body at the
ceiling, and typically ~270KB. **`apps/api` sets no body limit anywhere today**, so uploads are
currently unbounded; Hono's own `bodyLimit` middleware covers it with no new dependency.

## Two database traps this shape sets

Both are the same class of finding the last review round caught on issue 08, so they are named
here rather than left to be discovered.

**1. `NULL` does not deduplicate.** A plain `UNIQUE (payment_method_id, store_id)` will not stop
a method accumulating many "default" rows, because Postgres treats `NULL`s as distinct. The
resolution `store_row ?? tenant_row` then returns whichever row the planner happens to hand
back. It needs **two partial unique indexes**:

```sql
CREATE UNIQUE INDEX ... ON "PaymentMethodPaymentDetails" (payment_method_id)
  WHERE store_id IS NULL;
CREATE UNIQUE INDEX ... ON "PaymentMethodPaymentDetails" (payment_method_id, store_id)
  WHERE store_id IS NOT NULL;
```

**2. `cash` must hold zero rows**, mirroring record 054 §"Smaller calls" 3, and enforced by a
trigger rather than a handler check — for the same reason issue 08's `cash` immutability trigger
exists: `deanpos_app` holds `INSERT` and `UPDATE` on the table, so an application bug can reach
past any handler. Cash is money in a drawer; it has no account to pay into.

## The obligation `checkout` inherits

Same seam as record 055. Nothing in this issue shows a QR to a paying customer — that screen is
Area 4 and is not built.

> At Store `S`, the payment details for method `M` are the row with
> `payment_method_id = M.id` and `store_id = S` **if one exists**, otherwise the row with
> `payment_method_id = M.id` and `store_id IS NULL`, otherwise none. The row is taken
> **whole**. Fields are never mixed across the two rows.

The bytes reach the terminal inside the payload `offline-sync` already caches
(`offline-sync/PRD.md:249` — the service worker precaches the app shell only, API responses are
explicitly not cached, IndexedDB owns data). The terminal renders from a `blob:` URL it already
holds. **Nothing on the sale path fetches anything**, which is what keeps
`checkout/PRD.md:810`'s falsifiable criterion — *"building an order and looking one up issue
zero network requests"* — true and testable with the transport stubbed to throw.

## How to turn it back

| What | Cost |
| --- | --- |
| The whole feature | Drop one table and one migration; `PaymentMethod` is untouched by it. Nothing else reads it until `checkout` ships. |
| Whole-row → field-wise resolution | One query change, plus the consistency rule this decision exists to avoid having to write. |
| `bytea` → object storage | A new ADR narrowing ADR-0012, an `S3_*` env block, a client, a fifth Compose service, and a migration that streams existing rows out. Additive; the column stays readable throughout. |
| Base64-in-`update` → a separate upload route | One route, one contract change, and an orphan story that does not currently exist. |

## What should make you reverse this

- **A second uploaded-asset need arrives** — a tenant logo, a MenuItem photo. Two callers is the
  point at which object storage stops being an exception and becomes a subsystem, and the
  `bytea` decision should be re-scored against the aggregate, not against this feature alone.
- **The sync payload measurably slows a terminal's first load.** Up to 1MB per method per Store
  now rides it, and `offline-sync` sized that payload without this. If it hurts, the images
  split into their own cached resource before object storage is reconsidered.
- **A tenant asks whether DeanPOS confirmed the payment.** That is the copy failing, not the
  storage. A displayed QR implies an integration far more strongly than a method named `GCash`
  ever did (`checkout/PRD.md:817`), and the screen must say plainly that nothing is verified.
- **`checkout` is drafted without the resolution predicate above reaching it.** The single
  failure mode of the carry-forward: a rule moved and then lost.

## Evidence

**Repository, read 2026-08-03 on `main` at `70b1edd`:**

- `packages/backend/src/db/prisma/schema.prisma:204` — `PaymentMethod` is `id · tenant_id ·
  name · kind · active · created_at`. No payload field of any kind.
- `packages/backend/src/db/prisma/schema.prisma:222` — `PaymentMethodAvailability`, positive
  join, `@@unique([paymentMethodId, storeId])`, composite FKs on `(tenant_id, id)`; the model
  comment confirms `cash` holds no rows.
- `packages/contract/src/contract.ts:139` — `paymentMethodUpdateInputSchema` is
  `{ id, name, storeIds }`; the comment records "one form, one Save, one transaction".
- `apps/api/src/app.ts` — Hono + oRPC `RPCHandler` over `fetch`. **`rg 'bodyLimit|maxBodySize'`
  across `apps/api/src` returns nothing**; request bodies are unbounded today.
- `.scratch/tenancy-identity/PRD.md:510`, `.scratch/checkout/PRD.md:750`,
  `.scratch/APP-PLAN.md:23` — the non-goal, stated three times.
- `docs/adr/0012-...md` — *"no bucket, and no object storage in v1"*, and its citation of
  ADR-0001's *"must run locally with no cloud credentials"* (`docs/adr/0001-...md:81`).
- `.scratch/offline-sync/PRD.md:249, 255, 392` — the service worker precaches the shell only;
  API responses are not SW-cached; the back office has no service worker and no offline mode.
- `.scratch/checkout/PRD.md:810` — the zero-network-requests criterion, and `:817` — *"a method
  named `GCash` invites that assumption far more strongly than one named `Card` did"*.
- `.scratch/release-ops/PRD.md:199` — object storage exists in this project only as an rclone
  `pg_dump` destination, with **no vendor named**. Record 011 — four Compose services, no
  bucket.

**Searched for and not found:** no S3 client, no upload handler, no multipart route, and no
image-handling code anywhere outside `node_modules`. This feature has no existing pattern in the
repository to follow, which is why the upload path is specified in full rather than by reference.
