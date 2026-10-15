# Architecture Overview

## 1. System Mission

TechProfiler is a continuous technical capability profiling platform for software engineering teams. It combines real SDLC evidence, interactive Proof of Skills sessions, agentic evaluation, a live competency matrix, and just-in-time learning modules.

The product goal is to answer four questions:

- What technical skills has a developer demonstrated recently?
- How far is that developer from the next role benchmark?
- What concrete evidence supports the score?
- What targeted learning module or lab should be assigned next?

## 2. Current State vs Target State

### Current State

The current runnable MVP is centered around:

- `dashboard.mjs`: Node HTTP server that renders the dashboard, supports collaborator registration, CSV cohort import, Proof of Skills chat, Proof of Skills final evaluation, and radar display.
- `packages/database`: Drizzle schema, SQL migration, seed scripts, and database connection.
- `packages/schemas`: shared validation contracts for Zod/AI responses and lightweight `.mjs` schemas used by the MVP.
- `packages/sanitizer`: deterministic secret redaction.
- `apps/agents`: TypeScript agent classes for code quality evaluation, reviewer dynamics, skill synthesis, and curriculum generation.

`apps/web` and `apps/api` currently exist as scaffold packages. They represent the intended platform split, but the production-grade Next.js/NestJS implementation is not yet present.

### Target State

The target architecture is an event-driven monorepo:

```text
GitHub / Labs / Reviews
        |
        v
API Gateway and ingestion workers
        |
        v
Sanitizer and deterministic extraction
        |
        v
Agent evaluation workers
        |
        v
PostgreSQL skill evidence and Tech Radar
        |
        v
Dashboard, reports, and L&D module runner
```

The target application split is:

- `apps/web`: Next.js dashboard, Tech Radar, admin views, participant flows, Monaco-based lab runner.
- `apps/api`: API gateway, GitHub webhooks, auth boundaries, queue dispatch, reporting endpoints.
- `apps/agents`: worker/runtime package for LLM-backed evaluators and deterministic synthesis.
- `packages/database`: relational schema, migrations, seeds, data access.
- `packages/schemas`: shared domain contracts and AI output schemas.
- `packages/sanitizer`: pre-LLM redaction and future AST-based extraction.

## 3. Architecture Principles

- Deterministic workflow first: registration, persistence, imports, reporting, and scoring aggregation must be deterministic.
- LLMs only where judgment is valuable: assessment, feedback synthesis, review quality, and curriculum generation.
- Structured output at the boundary: every model response must be validated before persistence.
- Immutable evidence: raw evaluation signals are appended to `evaluation_signals`; synthesized scores can be updated.
- Tenant isolation: every developer belongs to an organization, and all future queries must preserve `org_id` boundaries.
- Security before intelligence: code and comments must be sanitized before leaving the system for an external model.
- Reviewer traceability: every agent evaluation should record model, prompt family, schema version, rubric version, and source reference.

## 4. Main Runtime Flows

### 4.1 Pilot Proof of Skills Flow

Implemented primarily in `dashboard.mjs`.

1. Facilitator registers a developer manually or through CSV import.
2. Dashboard starts a Proof of Skills conversation.
3. Gemini generates the first case and follow-up questions.
4. User answers technical questions.
5. Final evaluation converts the transcript into `skillEvaluations`.
6. Evaluation is stored in `evaluation_signals`.
7. `developer_skill_matrix` is updated by skill key.
8. Dashboard renders radar, gaps, and assigned modules.

### 4.2 Code Quality Evaluation Flow

Implemented as an agent class in `apps/agents`.

1. Caller provides a code diff or module content.
2. `SecretSanitizer` redacts secrets.
3. Agent sends sanitized content and rubric instructions to Gemini.
4. JSON response is parsed and validated with Zod.
5. If persistence is enabled, the result is stored in `evaluation_signals`.
6. `developer_skill_matrix` is updated against seniority benchmarks.

### 4.3 Reviewer Dynamics Flow

Implemented as an agent class in `apps/agents`.

1. Caller provides review comments and optional PR context.
2. Comments/context are sanitized.
3. Agent evaluates tone, pedagogy, technical rigor, and actionability.
4. Zod validates the model output.
5. Persistence stores immutable evidence and updates the skill matrix.

### 4.4 Skill Synthesis Flow

Implemented as `SkillSynthesizerAgent`.

1. Load all historical `evaluation_signals` for a developer.
2. Extract `skillEvaluations`.
3. Ignore unknown skill keys not present in `skill_taxonomy`.
4. Apply exponential time decay:

```text
weight = e^(-lambda * days_elapsed)
score = sum(weight * score) / sum(weight)
```

5. Compare synthesized score to `seniority_benchmarks`.
6. Persist updated `developer_skill_matrix`.
7. Ask Gemini for concise executive synthesis.

### 4.5 Curriculum Builder Flow

Implemented as `CurriculumBuilderAgent`.

1. Load developer, organization, and skill taxonomy context.
2. Ask Gemini to generate a micro-learning module for a specific skill gap.
3. Validate the module contract.
4. Persist assignment into `learning_modules`.

## 5. Data Architecture

Primary tables:

- `organizations`: tenant/company boundary.
- `developers`: collaborator profiles, seniority target, track, organization.
- `skill_taxonomy`: canonical skill keys, domains, rubrics.
- `seniority_benchmarks`: required score by track, seniority level, and skill.
- `developer_skill_matrix`: current radar state per developer and skill.
- `evaluation_signals`: immutable raw evidence from interviews, PR evaluations, reviews, and challenges.
- `learning_modules`: assigned L&D modules and interactive challenge payloads.

Current canonical taxonomy in SQL seed:

- `CLEAN_ARCHITECTURE`
- `SYSTEM_DESIGN_SCALABILITY`
- `SQL_OPTIMIZATION_CONCURRENCY`
- `OWASP_INPUT_VALIDATION`
- `TESTING_STRATEGY`
- `OBSERVABILITY_INCIDENTS`
- `API_CONTRACTS`
- `CODE_REVIEW_RIGOR`

Important implementation note: agent prompts and schemas must use the same canonical taxonomy as the database. Any aliasing should happen before persistence and should be tested.

## 6. Architecture Decisions

### ADR-001: Monorepo with Turborepo and pnpm

Decision: use a monorepo so schemas, database contracts, sanitizer, agents, API, and dashboard share one versioned source.

Rationale:

- Avoid duplicate domain contracts.
- Keep agent output contracts aligned with persistence.
- Enable workspace-level typecheck and test orchestration.

### ADR-002: PostgreSQL as System of Record

Decision: PostgreSQL stores organizations, developers, evaluations, skill matrix, benchmarks, and learning modules.

Rationale:

- Strong consistency for evaluation evidence.
- Simple pilot operations.
- Future pgvector support can live in the same database if semantic matching becomes necessary.

### ADR-003: Immutable Evaluation Signals

Decision: raw evaluation events are append-only in `evaluation_signals`; summarized radar state lives in `developer_skill_matrix`.

Rationale:

- Auditability for People/Engineering stakeholders.
- Recomputable skill matrix when rubrics evolve.
- Easier dispute review.

### ADR-004: Sanitization Before LLM Calls

Decision: code, diffs, comments, and PR context must pass through deterministic redaction before external model calls.

Rationale:

- Reduces risk of leaking secrets or proprietary data.
- Keeps model prompts focused on technical evidence.
- Supports corporate pilot requirements.

### ADR-005: MVP First, Platform Split Later

Decision: keep the runnable MVP in `dashboard.mjs` until pilot flows are validated; migrate to `apps/web` and `apps/api` once behavior stabilizes.

Rationale:

- Faster pilot iteration.
- Lower orchestration cost while product risk remains high.
- Avoid premature Nest/Next complexity before core workflows prove value.

## 7. Known Gaps

- `apps/web` and `apps/api` are scaffolded but not full implementations.
- Build and lint scripts for scaffold apps need dependency alignment before they can be considered CI-ready.
- Agents and database taxonomy must remain synchronized; this is currently a critical maintenance point.
- BullMQ/Redis event queues are target architecture, not yet the main runtime.
- Monaco lab execution is target functionality, not yet implemented in the dashboard.
- Structured model output relies on JSON mode plus validation; provider-native schema generation should be evaluated.

## 8. Production Readiness Criteria

Before production use:

- `pnpm typecheck`, `pnpm build`, `pnpm test`, and `pnpm lint` pass consistently.
- All AI responses are covered by fixtures for valid, malformed, incomplete, and refusal cases.
- Every persisted evaluation includes audit metadata.
- Every request path enforces organization scoping.
- Admin and participant flows require authentication.
- Pilot reports can be exported without querying the database manually.
- Taxonomy changes are versioned and tested against historical signals.
