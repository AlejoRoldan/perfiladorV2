# Perfilador Database

Versioned SQL for the MVP database lives here.

## Files

- `migrations/001_initial_schema.sql`: tables, constraints, and indexes required by the current scripts and dashboard.
- `seeds/001_base_taxonomy.sql`: base organizations, skill taxonomy, rubrics, and seniority benchmarks.
- `scripts/apply-sql.mjs`: applies migrations and seeds to the `DATABASE_URL` in `.env`.

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

The SQL is idempotent, so it can be safely re-applied during MVP development.
