# ValveTrade

A TypeScript + PostgreSQL lead-collection pipeline skeleton. It demonstrates a small
set of reusable, production-minded patterns you can build a real data pipeline on top of:

- **DB-level integrity guards** — triggers enforce data invariants in the database, not
  just in application code (e.g. a seller-type company can never become a lead, a
  lead-referenced company cannot be reclassified into a seller, and a frozen report
  snapshot is write-once while its telemetry columns stay mutable).
- **Row-level-security multi-tenancy** — the app connects as a non-owner role; every
  engagement-scoped table is isolated by a transaction-scoped setting and fails closed
  when that setting is unset.
- **Source connector + fuzzy-dedup wash pipeline** — a uniform connector contract feeds a
  wash stage (ingest → dedup → classify → qualify); dedup keys on an exact business
  identifier first, then falls back to `pg_trgm`-blocked fuzzy name matching.
- **Tests on embedded Postgres** — the full suite runs against a real, embedded PostgreSQL
  instance (no Docker required), so triggers, RLS, and `pg_trgm` behave exactly as in
  production.

## Quickstart

```bash
pnpm install
pnpm typecheck
pnpm test
```

The test suite starts its own embedded PostgreSQL, applies the migrations, and runs the
guard, RLS, dedup, and end-to-end pipeline tests. No external database or Docker is needed.

## Package layout

```
packages/
  db/        migrations (schema, guards, RLS, seed) + migration runner + pool helpers
  domain/    pure domain logic: enums, normalization, buyer/seller rule, lead factory
  pipeline/  source-connector contract, fuzzy dedup, wash pipeline, fixture connector, tests
```

## License

MIT — see [LICENSE](./LICENSE).
