# Context map — DeanPOS

DeanPOS is a **multi-tenant SaaS point-of-sale for counter-service food businesses**
(Filipino carinderia / fast-casual). One deployment serves many unrelated restaurants.

Contexts and where their vocabulary lives:

| Context | Owns | Glossary |
| --- | --- | --- |
| **Tenancy & access** | Tenant, Store, User, Role, Device, Shift authority | [`CONTEXT.md`](CONTEXT.md) |
| **Catalog** | MenuItem, Variant, Modifier, Add-on, pricing | [`CONTEXT.md`](CONTEXT.md) |
| **Sales** | Order, OrderLine, Payment, Void, Refund | [`CONTEXT.md`](CONTEXT.md) |
| **Cash control** | DrawerSession, Float, Cash count, Variance | [`CONTEXT.md`](CONTEXT.md) |
| **Workforce** | Shift, Roster, Publish — rostering only, never cash | [`CONTEXT.md`](CONTEXT.md) |
| **Sync** | Outbox, Replay, Device clock | [`CONTEXT.md`](CONTEXT.md) |

While the repo is a single monorepo without a settled `src/` layout, all five share
one root `CONTEXT.md`. Split it into `apps/*/CONTEXT.md` when a context earns its own
module boundary — not before.

Decisions: system-wide ADRs in [`docs/adr/`](docs/adr/); pipeline decision records in
[`.scratch/decisions/`](.scratch/decisions/).
