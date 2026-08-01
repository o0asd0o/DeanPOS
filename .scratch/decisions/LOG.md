# Decision log

One line per record. The files in this directory are the numbering authority; this index is regenerable.

- [001: The project stores data in PostgreSQL](001-database-engine.md) — seeded at setup, Stakes: high
- [002: Money gets property tests from `fast-check`, and nothing else is added](002-property-testing-for-money.md) — `fast-check@4.9.0`, devDependency-only, catalog-pinned; no `@fast-check/vitest`, Stakes: high
- [003: Every Delta on a line is measured against the item's own price, and only one can be a multiplier](003-delta-composition.md) — ratifies the built arithmetic (contributions summed against the base, order-independent, exact); adds a one-multiplier-per-OrderLine guard in `catalog` and `checkout` that keeps the rule free to reverse, Stakes: high
- [004: Kysely talks to PostgreSQL through `pg`, the same driver the sibling project runs](004-postgres-driver.md) — `pg@8.22.0` dependency + `@types/pg@8.20.3` devDependency in `packages/backend` only, no catalog pin, Kysely's built-in `PostgresDialect`; adopts ApxDenta's production Bun setup; transaction-affinity guaranteed by Kysely's driver, so area 2 uses `set_config(..., true)`; no `pg-native`, Stakes: high
