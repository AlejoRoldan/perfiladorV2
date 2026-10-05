# Backend and Frontend Structure

## 1. Monorepo Layout

```text
perfiladorV2-scaffold/
  apps/
    agents/
    api/
    web/
  packages/
    database/
    sanitizer/
    schemas/
  docs/
  docker/
  dashboard.mjs
  run-pipeline.mjs
  resolve-challenge.mjs
  test-agent.mjs
```

The repository currently supports two layers:

- MVP layer: `dashboard.mjs` plus database packages and scripts.
- Platform layer: `apps/*` and `packages/*`, intended for the longer-term Next.js/NestJS/worker split.

## 2. Current MVP Runtime

`dashboard.mjs` currently owns:

- HTTP server.
- HTML rendering.
- Basic dashboard navigation.
- Collaborator registration.
- CSV cohort import.
- Proof of Skills conversation.
- Final Proof of Skills evaluation.
- Radar rendering.
- Learning module display.
- Direct PostgreSQL queries.
- Gemini calls through `@google/genai`.

This is acceptable for pilot validation, but should not become the long-term platform boundary. New durable product features should be designed so they can migrate cleanly into `apps/web` and `apps/api`.

## 3. Target Backend Structure

### `apps/api`

Target responsibility:

- Authentication boundary.
- Organization and role authorization.
- REST or tRPC endpoints.
- GitHub webhook ingestion.
- Cohort management endpoints.
- Dashboard data aggregation endpoints.
- Queue dispatch to async workers.
- Export/reporting endpoints.

Planned modules:

- `AuthModule`: sessions, roles, tenant scoping.
- `OrganizationsModule`: organization read/write and tenant metadata.
- `DevelopersModule`: collaborator registration, CSV import, profile updates.
- `EvaluationsModule`: evaluation signal ingestion and retrieval.
- `RadarModule`: skill matrix queries and recomputation triggers.
- `LearningModule`: L&D assignments and completion status.
- `GithubModule`: webhook signature verification and PR event normalization.
- `ReportsModule`: pilot and individual report export.

Backend best practices:

- Never trust client-provided `orgId`; derive it from authenticated context.
- Validate all inputs with shared schemas.
- Return typed error responses with stable error codes.
- Keep model calls out of request handlers except for explicitly interactive endpoints.
- Queue long-running evaluations.
- Store audit metadata for every external AI call.

## 4. Target Frontend Structure

### `apps/web`

Target responsibility:

- Participant dashboard.
- Admin/facilitator dashboard.
- Tech Radar visualization.
- Proof of Skills UI.
- Learning module viewer.
- Monaco lab runner.
- Reports and exports.

Recommended route structure:

```text
app/
  dashboard/
    page.tsx
  participants/
    [developerId]/
      page.tsx
  pilot/
    itti/
      page.tsx
  proof-of-skills/
    [sessionId]/
      page.tsx
  learning/
    [moduleId]/
      page.tsx
  admin/
    cohorts/
      page.tsx
    reports/
      page.tsx
```

Frontend best practices:

- Treat the first screen as an operational dashboard, not a marketing page.
- Use dense, scan-friendly UI for admin workflows.
- Keep participant flows simple and focused.
- Avoid exposing raw prompts or internal scoring internals to participants.
- Show evidence, score rationale, confidence, and next action.
- Make failure states explicit: model unavailable, validation failed, session incomplete, no benchmark found.

## 5. Shared Packages

### `packages/database`

Owns:

- Drizzle schema.
- SQL migrations.
- Seeds.
- Database connection.
- Future data access helpers.

Rules:

- Drizzle schema and SQL migrations must stay aligned.
- Seeds must be idempotent.
- Taxonomy keys are canonical domain contracts.
- Add migrations for schema changes; do not rely only on Drizzle type changes.

### `packages/schemas`

Owns:

- Zod contracts for domain input/output.
- AI response schemas.
- Shared enum definitions.
- Future API request/response contracts.

Rules:

- Agents and API endpoints must validate against these schemas.
- Schema changes must include fixture updates.
- Avoid permissive `z.string()` where a canonical enum is available.

### `packages/sanitizer`

Owns:

- Secret and token redaction.
- Future AST extraction and safe code summaries.

Rules:

- Sanitization must run before external model calls.
- Tests must cover every new redaction rule.
- Redaction should preserve enough structure for technical evaluation while removing sensitive values.

## 6. Agent Runtime Structure

`apps/agents` should remain a runtime/library package for evaluation logic. It should not own web rendering or API auth.

Recommended long-term directories:

```text
apps/agents/src/
  code-quality-profiler.ts
  reviewer-dynamics.ts
  skill-synthesizer.ts
  curriculum-builder.ts
  shared/
    gemini-client.ts
    ai-json.ts
    taxonomy.ts
    persistence.ts
  workers/
    agent-eval-worker.ts
    curriculum-worker.ts
```

Refactoring direction:

- Extract duplicate Gemini retry logic.
- Centralize taxonomy aliasing.
- Centralize audit metadata.
- Keep persistence optional for easier deterministic testing.

## 7. Migration Path from MVP to Platform

1. Stabilize canonical taxonomy and schemas.
2. Add reliable build/test/lint pipeline.
3. Extract dashboard data operations into reusable service functions.
4. Move participant/admin UI into `apps/web`.
5. Move HTTP API operations into `apps/api`.
6. Introduce queues for long-running model workflows.
7. Add Monaco runner and deterministic challenge execution.
8. Deprecate `dashboard.mjs` after equivalent platform flows exist.

## 8. Repository Hygiene

- Keep generated or third-party skill packs under `vendor/` if imported.
- Keep `.env` local only.
- Do not commit real participant data.
- Keep pilot-specific docs under `docs/`.
- Every architecture-affecting PR should update docs in this folder.
