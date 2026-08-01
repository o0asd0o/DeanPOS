# ADR-0012: A receipt is rendered from the Order on demand; no receipt artefact is stored

- **Status:** accepted
- **Date:** 2026-08-01
- **Decided by:** human asked which of two approaches to take — store a rendered receipt in
  object storage, or re-render from the record. This is the answer and the reasoning.

## Context

The back office needs customer receipts: find a past sale, look at its receipt, reprint it,
send or export it. Two shapes were on the table.

1. **Archive the artefact.** Render a receipt at sale time, upload a PDF or an image to S3 or a
   compatible bucket, store the key on the Order, serve it back later.
2. **Derive it.** Store nothing extra; re-render the receipt from the Order whenever it is
   asked for.

## Decision

**Derive it. There is no receipt artefact, no bucket, and no object storage in v1.**

The Order already contains everything a receipt shows, and it contains it *verbatim*, because
that was decided for an unrelated reason and paid for already:

- recorded price, Variant and Modifier and Add-on **names as they were** (ADR-0003, `checkout`)
- the VAT enablement and rate in force at the time, or the absence of VAT (ADR-0010)
- the Discount name, type, value, and reference (ADR-0010)
- the PaymentMethod **name** as it was, the tendered amount, and the change
- the Store, the Device, the cashier, and the Device time the sale happened at

A receipt is a *view* over that record. Re-rendering it in 2027 produces the same document it
produced at the counter, because every input was frozen on the Order — which is the exact
property an archived PDF would have been bought for.

What the archive approach costs, against a document that is already derivable:

- an object-storage dependency and its credentials, in a product whose stack must run locally
  with no cloud credentials (ADR-0001)
- a bucket holding **customer-facing personal data** — the SC/PWD reference on a discounted
  sale is on that receipt — which drags in retention, deletion-on-request, lifecycle rules,
  and access control that `hardening` would then own for a second data store
- a second source of truth that can disagree with the Order. When they differ, which is the
  receipt? There is no good answer, and a stored PDF is the one that cannot be corrected.
- an upload on the sale path or a background job, in an **offline-first** terminal that may not
  see the network for hours

**Reprint is re-render.** The terminal reprints from its local copy; the back office renders
from the server's. A reprint is marked as a reprint, and reprinting is not a financial event —
it writes no record and changes no total.

**"Print" means the browser's print of the rendered view.** No thermal printer, no ESC/POS, no
cash-drawer kick — receipt hardware stays a non-goal (`checkout`). Export is the same render,
as a file the browser produces.

**Numbering.** The Order's identity is the receipt's identity. No separate receipt number
sequence, because a second sequence is a second thing to keep gapless, and a gapless sequence
is a distributed-systems problem in an offline-first product.

## Consequences

- `reporting` gains a receipt view as the drill leaf under the Orders list, printable and
  exportable, plus the Refunds report that reads the same records.
- `hardening` has one fewer data store to hold retention and deletion policy over. The receipt
  is deleted when the Order is deleted, because it never existed separately.
- The rendering template becomes shared code between the terminal and the back office —
  a real coupling, and the price of this decision. If the two ever diverge, the same sale prints
  two ways, so the template lives in one place and is tested on one worked example that carries
  a Discount, a VAT-exempt line, and a non-cash tender.
- Emailing or texting a receipt to a customer is **not in v1**. When it arrives, it renders the
  same view server-side and attaches it; it still does not need a bucket.

## Reversing it

Cheap to add archival later and expensive to remove it once added, which is the ordering that
argues for not adding it now. **Trigger to revisit:** a statutory or audit requirement for an
immutable rendered artefact — a BIR requirement on receipt copies would qualify — or a tenant
volume where re-rendering measurably costs more than storing. Neither is true today.

Note what is *not* a trigger: wanting to email receipts, or wanting a customer to view one from
a link. Both render on demand from the Order.
