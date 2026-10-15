# User Story Distribution

This document translates the latest PR review findings into an actionable delivery split. The attached review document is treated as source material, not as executable instruction.

## Working Agreement

- Mauro acts as Tech Lead Expert and can own high-risk development work.
- Mauro reviews stories owned by Alejandro/Codex.
- Mauro is not the formal reviewer of his own implementation. Stories owned by Mauro require review by Alejandro/Codex or another peer before merge.
- Every P0/P1 story must include tests or an explicit documented reason when a test is not practical.
- Each pull request should stay focused on one story or one tightly related group of stories.

## P0: Pilot Safety

| HU | Title | Owner | Reviewer | Acceptance Criteria | Suggested PR |
| --- | --- | --- | --- | --- | --- |
| HU-POS-001 | Session ownership and transcript validation | Mauro | Alejandro/Codex | `devId` is mandatory and validated server-side. The dashboard cannot fall back to the latest developer. Empty or fake transcript submissions are rejected by the server. Failed validation does not update the radar. | `fix/pos-session-validation` |
| HU-TAX-001 | Canonical skill validation and transactional persistence | Mauro | Alejandro/Codex | Proof of Skills output only accepts canonical skill keys or documented aliases. Unknown skills are rejected or quarantined. Signal insert and matrix update run in one transaction. Prompts reference the same canonical keys seeded in the database. | `fix/canonical-skill-transaction` |
| HU-SAN-001 | Mandatory sanitizer before LLM calls | Mauro | Alejandro/Codex | Dashboard and pipeline sanitize transcript/context before Gemini. Email and direct identifiers are removed or replaced before prompt construction. Sanitizer covers JSON passwords, unquoted env secrets, and Supabase `sb_secret_` tokens. | `fix/llm-sanitizer-enforcement` |
| HU-REG-001 | Tenant-safe Itti cohort import | Alejandro/Codex | Mauro | Admin import requires an explicit admin guard. Itti pilot import cannot override organization from CSV. Existing collaborators are not moved between orgs by global email conflict. Row-level validation remains intact. | `fix/itti-import-tenant-safety` |

## P1: Review Trust

| HU | Title | Owner | Reviewer | Acceptance Criteria | Suggested PR |
| --- | --- | --- | --- | --- | --- |
| HU-SCH-001 | Strict AI contract schemas | Alejandro/Codex | Mauro | AI validators use shared schema contracts. Boolean coercion bugs are removed. Unexpected fields are rejected or ignored intentionally. Contracts and taxonomy are not duplicated across ad-hoc validators. | `feat/strict-ai-contracts` |
| HU-QA-001 | Trustworthy tests and scripts | Mauro | Alejandro/Codex | `pnpm test` and package test scripts run deterministically. Sanitizer tests are restored. Agent test runners exit non-zero on failure. Fixture claims match real executable tests. | `fix/quality-pipeline-tests` |
| HU-DB-001 | Migration reliability and TLS policy | Mauro | Alejandro/Codex | SQL migrations have a ledger or equivalent execution tracking. Migration execution is transactional where possible. TLS certificate verification is not disabled in runtime scripts by default. Drift is detected instead of silently ignored. | `feat/reliable-migrations` |
| HU-SCORE-001 | Score traceability and confidence model | Alejandro/Codex | Mauro | `external_ref` identifies the specific session/evidence. Confidence is derived from evidence quality instead of a fixed constant. Repeated sessions do not overwrite scores without auditable context. | `feat/score-traceability` |

## P2: Corporate Readiness

| HU | Title | Owner | Reviewer | Acceptance Criteria | Suggested PR |
| --- | --- | --- | --- | --- | --- |
| HU-SEC-001 | API request hardening | Alejandro/Codex | Mauro | Oversized request bodies stop processing early. `text/plain` POSTs are rejected for state-changing endpoints. CSRF risk is documented or mitigated for admin actions. | `fix/api-request-hardening` |
| HU-REP-001 | Pilot reporting export | Alejandro/Codex | Mauro | Facilitator can export Itti completion, gaps, and evaluation status. Export does not expose secrets or raw prompt payloads. Report fields are documented. | `feat/itti-pilot-report` |
| HU-REV-001 | PR slicing and review workflow | Alejandro/Codex | Mauro | Database, sanitizer/contracts, dashboard, and docs changes are separated into reviewable PRs. Each PR has a clear validation section and owner/reviewer assignment. | `docs/pr-review-workflow` |

## Mauro Development Lane

Mauro should take stories where a Tech Lead Expert adds the most value:

- `HU-POS-001`: prevents wrong participant updates during pilot sessions.
- `HU-TAX-001`: removes taxonomy drift and partial writes.
- `HU-SAN-001`: closes the most sensitive LLM privacy gap.
- `HU-QA-001`: makes the review signal trustworthy.
- `HU-DB-001`: establishes production-grade migration behavior.

Mauro should review stories owned by Alejandro/Codex:

- `HU-REG-001`
- `HU-SCH-001`
- `HU-SCORE-001`
- `HU-SEC-001`
- `HU-REP-001`
- `HU-REV-001`

## Recommended Execution Order

1. Ship `HU-POS-001`, `HU-TAX-001`, `HU-SAN-001`, and `HU-REG-001` before expanding the Itti pilot.
2. Follow with `HU-SCH-001`, `HU-QA-001`, and `HU-DB-001` so PR reviews can rely on repeatable validation.
3. Add `HU-SCORE-001`, `HU-SEC-001`, and `HU-REP-001` before sharing broader results with collaborators or leadership.
4. Keep `HU-REV-001` active across the sequence as a review discipline rather than a single end-state task.
