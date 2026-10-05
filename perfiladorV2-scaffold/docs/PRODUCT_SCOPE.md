# Product Scope and Delivery Roadmap

## 1. Product Vision

TechProfiler helps engineering organizations understand and improve technical capability using real evidence from the software development lifecycle.

The platform combines:

- Real or simulated engineering signals.
- Agentic evaluation.
- A live Tech Radar per developer.
- Benchmark comparison by seniority and track.
- Just-in-time learning modules.
- Operational reporting for pilots and leadership.

## 2. Users

### Developer / Participant

Goals:

- Complete Proof of Skills sessions.
- See personal radar and skill gaps.
- Receive targeted learning modules.
- Complete practical labs and improve scores.

### Facilitator / L&D Operator

Goals:

- Register participants.
- Import pilot cohorts.
- Monitor completion.
- Review generated recommendations.
- Export pilot reports.

### Engineering Leader

Goals:

- Understand team-level capability trends.
- Identify recurring technical gaps.
- Prioritize enablement and training.
- Review evidence behind recommendations.

### Reviewer / Auditor

Goals:

- Verify that scoring is traceable.
- Confirm model outputs are validated.
- Confirm no raw secrets are sent to LLM providers.
- Ensure agent behavior is documented and testable.

## 3. Current MVP Features

Implemented or partially implemented:

- Organization and developer data model.
- Skill taxonomy and seniority benchmarks.
- Local Docker PostgreSQL/Redis environment.
- Dashboard MVP through `dashboard.mjs`.
- Manual collaborator registration.
- CSV import for Itti pilot cohort.
- Proof of Skills conversational flow.
- Final transcript evaluation.
- Tech Radar state in `developer_skill_matrix`.
- Learning module storage and display.
- Secret sanitizer package.
- Agent classes for code quality, review dynamics, skill synthesis, and curriculum generation.

## 4. Planned Platform Features

### Participant Experience

- Authenticated participant dashboard.
- Guided Proof of Skills sessions.
- Radar with evidence explanations.
- Assigned learning modules.
- Monaco-based coding labs.
- Lab test execution and challenge completion.
- Individual development plan.

### Facilitator Experience

- Cohort creation and import.
- Session status dashboard.
- Manual retry/resume for failed sessions.
- Participant invitations.
- Completion tracking.
- Exportable reports.

### Engineering Leadership

- Cohort-level skill gap analysis.
- Aggregated radar by track/seniority.
- Top recurring gaps.
- Recommended L&D investment themes.
- Individual drill-down with evidence.

### GitHub / SDLC Integration

- GitHub OAuth/App configuration.
- Webhook ingestion.
- PR diff evaluation.
- Code review comment evaluation.
- Commit and review evidence linking.
- Audit trail by external PR reference.

### Agent and AI Operations

- Prompt/rubric versioning.
- Structured-output fixtures.
- Evals before prompt changes.
- Cost and latency logging.
- Model fallback policy.
- Human review workflow for disputed scores.

## 5. Delivery Epics

### Epic 1: Documentation and Reviewer Readiness

Goal: make the repository understandable and reviewable before more implementation.

Deliverables:

- Architecture docs.
- Agent catalog.
- Backend/frontend structure docs.
- Product scope and roadmap.
- Engineering standards.
- Pilot operations docs.

Acceptance criteria:

- A reviewer can identify current vs planned functionality.
- A reviewer can understand every agent and its persistence behavior.
- A developer can locate where to add backend, frontend, agent, schema, and database changes.

### Epic 2: Canonical Domain Foundation

Goal: eliminate taxonomy and schema drift.

Deliverables:

- Single canonical taxonomy source.
- Alias map for model-returned skill variants.
- Shared enums in `packages/schemas`.
- Drizzle schema aligned with SQL migrations.
- Seed scripts aligned with SQL seed.

Acceptance criteria:

- Unknown skill keys cannot silently update the radar.
- All prompts reference canonical keys.
- Typecheck and seed scripts agree on the same domain vocabulary.

### Epic 3: Quality Pipeline

Goal: make repository commands trustworthy.

Deliverables:

- Working `pnpm build`.
- Working `pnpm test`.
- Working `pnpm lint`.
- Vitest config scoped inside repo.
- CI-ready scripts for scaffold packages.

Acceptance criteria:

- A fresh checkout can install, typecheck, test, and build.
- MVP package tests pass deterministically.
- Broken scaffold dependencies do not mask real failures.

### Epic 4: Itti Pilot Hardening

Goal: support a controlled pilot with 20 collaborators.

Deliverables:

- Cohort import.
- Session status tracking.
- Audit metadata for Proof of Skills.
- Basic facilitator dashboard.
- Exportable pilot report.
- Error handling for model failures.

Acceptance criteria:

- At least 16 of 20 participants can complete a session.
- Every completed session creates an `evaluation_signals` row.
- Every evaluated skill maps to a canonical benchmark.
- Facilitator can export completion and gap data.

### Epic 5: Platform Migration

Goal: move MVP flows into the intended app structure.

Deliverables:

- `apps/api` endpoints for dashboard data, registration, Proof of Skills, modules, and reports.
- `apps/web` screens for participant/admin workflows.
- Shared schemas between client and server.
- Authentication and tenant scoping.

Acceptance criteria:

- `dashboard.mjs` has a feature-equivalent replacement.
- User flows work through `apps/web` and `apps/api`.
- Tenant data access is enforced in backend services.

### Epic 6: Agent Runtime and Queues

Goal: support asynchronous SDLC evaluations.

Deliverables:

- BullMQ queues.
- GitHub webhook endpoint.
- Ingest worker.
- Agent evaluation worker.
- Retry/backoff/error records.

Acceptance criteria:

- GitHub webhook returns a fast acknowledgement.
- Evaluation jobs can be retried safely.
- Failed jobs are visible to facilitators/admins.

### Epic 7: Interactive Labs

Goal: close gaps through practical assessment.

Deliverables:

- Learning module challenge schema.
- Monaco editor integration.
- Deterministic test runner.
- Challenge evaluator.
- Module completion and radar update flow.

Acceptance criteria:

- Generated module includes starter code and verification criteria.
- User can submit a solution.
- Tests or evaluator produce a verdict.
- Passing a lab updates module status and skill evidence.

## 6. Functional Requirements

### FR-001 Developer Registration

The system must create or update developers with organization, email, current seniority, target seniority, and tech track.

### FR-002 Cohort Import

The system must import CSV cohorts, validate each row independently, and report row-level errors.

### FR-003 Proof of Skills

The system must run an interactive technical interview and produce validated skill evaluations.

### FR-004 Tech Radar

The system must display current skill scores, required benchmark scores, and gaps.

### FR-005 Agent Evaluation

The system must evaluate code and review signals through documented agents and persist evidence.

### FR-006 Learning Module Assignment

The system must generate or assign learning modules for critical gaps.

### FR-007 Reporting

The system must export cohort and individual results for review.

## 7. Non-Functional Requirements

- Security: no real secrets in logs, prompts, docs, or committed files.
- Privacy: participant data must be tenant-scoped.
- Auditability: scores must trace back to evidence.
- Reliability: model failures must not corrupt existing radar state.
- Maintainability: shared contracts must live in packages, not duplicated prompts.
- Testability: prompts and parsers need fixtures.
- Performance: webhooks should acknowledge quickly and offload expensive work.

## 8. Release Stages

### Stage 0: Repository Alignment

- Documentation.
- Taxonomy alignment.
- Quality commands.

### Stage 1: Pilot MVP

- Run Itti pilot on `dashboard.mjs`.
- Collect completion metrics.
- Export results manually or through basic report endpoint.

### Stage 2: Platform Beta

- Migrate MVP into `apps/web` and `apps/api`.
- Add authentication.
- Add structured admin dashboard.

### Stage 3: SDLC Integration

- GitHub app/webhooks.
- Async queues.
- PR and review evidence.

### Stage 4: L&D Lab Platform

- Monaco labs.
- Challenge runner.
- Deterministic verification.

### Stage 5: Enterprise Hardening

- Role-based access.
- Full audit logs.
- Cost governance.
- Human review workflow.
- Production observability.
