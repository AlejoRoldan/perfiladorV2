# Engineering Standards

This document defines the engineering bar for TechProfiler. It should be used by contributors and reviewers before merging code.

## 1. General Principles

- Prefer small, reviewable changes.
- Keep implementation aligned with documented architecture.
- Do not add new frameworks unless they solve a current, concrete problem.
- Use shared packages for shared contracts.
- Keep pilot speed, auditability, and safety in balance.
- Document meaningful architecture changes in `docs/`.

## 2. Repository Commands

Expected commands:

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm lint
```

Current note: some scaffold app scripts may require dependency alignment before the full command set passes. Any PR that claims production readiness must make these commands reliable from a fresh checkout.

## 3. TypeScript Standards

- Use strict TypeScript.
- Avoid `any` unless isolating unknown external data.
- Validate unknown inputs at boundaries.
- Keep DTOs/contracts in `packages/schemas`.
- Do not duplicate enums across agents, API, and database.
- Prefer explicit return types for exported agent methods and service functions.

## 4. Database Standards

- SQL migrations are the source of physical database changes.
- Drizzle schema must mirror migration tables and column names.
- Seeds must be idempotent.
- Taxonomy keys are domain contracts; changing them requires migration and compatibility plan.
- `evaluation_signals` should remain append-only.
- `developer_skill_matrix` may be updated as synthesized state.
- All future queries must enforce organization scoping.

## 5. AI and Agent Standards

- Sanitize before model calls.
- Validate after model calls.
- Store model outputs only after schema validation.
- Keep quantitative calculations deterministic.
- Use LLMs for judgment and explanation, not for basic state transitions.
- Include audit metadata for durable evaluations.
- Add fixtures before changing prompts, rubrics, or model names.
- Never allow an agent to silently invent canonical skill keys.

## 6. Prompt Standards

Prompts must specify:

- role/context.
- target seniority and track.
- canonical taxonomy keys.
- exact JSON output shape.
- scoring range.
- evidence expectations.
- refusal/failure handling where applicable.

Prompt changes should be reviewed like code changes because they can change product behavior.

## 7. Sanitization and Security

- `.env` files must not be committed.
- No real participant data in tests or docs unless explicitly anonymized.
- No raw secrets in logs.
- Code and diffs must pass through `SecretSanitizer` before LLM calls.
- Authentication and role checks must be added before production use.
- Webhook endpoints must verify signatures.

## 8. Testing Standards

Minimum test coverage by area:

- Sanitizer: unit tests per redaction rule.
- Schemas: valid and invalid examples.
- Agents: persistence-disabled tests, malformed JSON, unknown skills, redaction path.
- Database: seed/migration smoke checks.
- Dashboard/API: registration, CSV import, Proof of Skills happy path and failure path.

Recommended fixture types:

- valid model response.
- malformed JSON.
- missing required field.
- invalid score range.
- unknown `skillKey`.
- model refusal or empty output.
- redacted secret input.

## 9. Frontend Standards

- Build task-focused views, not marketing pages.
- Admin screens should be dense, readable, and operational.
- Participant screens should minimize cognitive load.
- Always show loading, empty, error, and success states.
- Do not expose internal prompts.
- Display evidence and rationale clearly enough for trust.
- Keep controls accessible and keyboard-friendly.

## 10. Backend Standards

- Keep long-running model operations outside synchronous request paths when possible.
- Use stable error codes.
- Validate request payloads.
- Enforce tenant boundaries.
- Log enough context for debugging without leaking secrets.
- Persist external references for traceability.
- Design APIs around product workflows, not database tables.

## 11. Documentation Standards

Update docs when changing:

- agent behavior.
- database schema.
- taxonomy.
- prompt/rubric contracts.
- API boundaries.
- dashboard flows.
- pilot operations.
- build/test/lint requirements.

Documentation should state whether a capability is implemented, partially implemented, or planned.

## 12. Pull Request Checklist

Before merge:

- Typecheck passes.
- Relevant tests pass.
- New or changed schema has docs.
- New agent behavior has fixtures.
- New model call sanitizes inputs.
- New persisted AI output is validated.
- Taxonomy changes are reflected in seeds, schemas, and docs.
- No secrets or real private data are committed.
- Reviewer can reproduce the behavior locally.
