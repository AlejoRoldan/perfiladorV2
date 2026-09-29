# Corporate Hardening Backlog

Use this backlog with `.agents/skills/perfilador-corporate-pilot/SKILL.md`.

## P0: Pilot Safety

- Add facilitator/admin view for Itti cohort progress. Initial MVP tab added in `dashboard.mjs`.
- Add participant import from CSV for 20 collaborators. Initial deterministic CSV import added in `dashboard.mjs`.
- Add session status tracking: not started, in progress, completed, failed.
- Add basic audit fields to LLM-generated evaluations: model, prompt family, schema version, rubric version.

## P1: Structured Output

- Replace prompt-only JSON instructions with provider-native structured output where Gemini support allows it.
- Keep Zod validation as the application boundary.
- Add explicit refusal/truncation/error handling around model responses.
- Add fixtures for malformed, incomplete, and valid model responses.

## P2: Evals Before Shipping

- Create 20-30 fixed Proof of Skills transcript fixtures.
- Define expected skill signals and acceptable scoring bands.
- Add regression checks for prompt/rubric changes.
- Track parse failure rate, score drift, and invented rationale rate.

## P3: Workflow Over Agent

- Keep registration, persistence, reporting, and cohort operations deterministic.
- Use LLMs for assessment, synthesis, and feedback only where judgment is needed.
- Avoid multi-agent orchestration until the fixed pipeline has measurable bottlenecks.

## P4: Model And Cost Governance

- Separate interview model from evaluator/judge model if needed.
- Log model name and token/cost metadata where available.
- Define fallback behavior for provider downtime.
- Set per-session budget ceilings before opening the pilot.

## P5: Corporate Reporting

- Export cohort report as CSV/JSON first.
- Add executive summary: completion rate, top gaps, recommended L&D modules.
- Add individual report: radar, evidence, rationale, next module.
- Add anonymized aggregate mode for leadership review.
