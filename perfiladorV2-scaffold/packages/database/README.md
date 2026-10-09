# Perfilador Database

Versioned SQL for the MVP database lives here.

## Files

- `migrations/001_initial_schema.sql`: tables, constraints, and indexes required by the current scripts and dashboard.
- `seeds/001_base_taxonomy.sql`: base organizations, skill taxonomy, rubrics, and seniority benchmarks.
- `scripts/apply-sql.mjs`: applies migrations and seeds to the `DATABASE_URL` in `.env`, records applied files in `schema_migrations`, and rejects checksum drift.

## Local Docker

For a fresh local database:

```bash
docker compose up -d
```

Docker runs:

1. `docker/postgres/init.sql`
2. `packages/database/migrations/001_initial_schema.sql`
3. `packages/database/seeds/001_base_taxonomy.sql`

Postgres only runs these files on first initialization of the data volume. If `pgdata` already exists, use the npm scripts below.

## Existing Database

```bash
pnpm db:migrate
pnpm db:seed
```

Or both:

```bash
pnpm db:setup
```

The SQL runner tracks every applied migration/seed file by filename and SHA-256 checksum in `schema_migrations`.

- Already-applied files with the same checksum are skipped.
- Edited files with a different checksum are rejected as drift; create a new SQL file instead.
- Each new SQL file is applied inside a transaction together with its ledger row.
- Remote databases use verified TLS by default. Local URLs (`localhost`, `127.0.0.1`, `db`) disable TLS. Set `DB_SSL_MODE=no-verify` only for an explicitly approved environment that requires it.
