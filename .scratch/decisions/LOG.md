# Decision log

One line per record. The files in this directory are the numbering authority; this index is regenerable.

- [001: The project stores data in PostgreSQL](001-database-engine.md) — seeded at setup, Stakes: high
- [002: Money gets property tests from `fast-check`, and nothing else is added](002-property-testing-for-money.md) — `fast-check@4.9.0`, devDependency-only, catalog-pinned; no `@fast-check/vitest`, Stakes: high
