# Itti Pilot Plan

Objective: run a controlled Proof of Skills pilot with 20 Itti collaborators, validate the assessment experience, and collect enough evidence to decide what to harden next.

Updated scope: [MVP acceptance criteria](MVP_ACCEPTANCE.md), 2026-10-20. The participant journey below is the target for acceptance, not a claim that all steps are implemented. Individual access exists only in local implementation changes that are excluded from this documentation PR; `main` still uses Basic Auth. Real provider/database/browser acceptance and the remaining MVP capabilities are pending.

## Pilot Scope

- Organization: itti Digital (`itti`)
- Cohort size: 20 collaborators
- Tracks: Backend Node.js, Fullstack, Frontend React
- Duration: 1 week
- Primary flow: invite participant, verify personal access, record consent, run a recoverable Proof of Skills interview, explain the radar, automatically assign learning for critical gaps, evaluate a short response and collect usefulness feedback

## Readiness Checklist

- Secrets live only in `.env`; `.env.example` has placeholders.
- Database schema and seed are applied with `pnpm db:setup`.
- Skills workflow is documented in `docs/SKILLS_INTEGRATION.md`.
- Project-local coordination skill exists at `.agents/skills/perfilador-corporate-pilot/SKILL.md`.
- Dashboard runs with `node dashboard.mjs` on `http://localhost:3005`.
- Pilot participants are registered with corporate emails.
- Invitation-only provider identities and application memberships are provisioned; shared credentials do not establish participant identity.
- Complete the eight capabilities and staging checks in `MVP_ACCEPTANCE.md`, including consent, per-session budget and assessment reference review.
- One support channel is defined for access issues and feedback.
- A rollback plan exists: stop the dashboard process and preserve DB backup/export.

## Participant Instructions

1. Request a personal access link with your pre-invited corporate email and confirm it. The local `PILOT_AUTH.md` setup guide must be published with the individual-access implementation before this journey is used.
2. Review the data-use notice and accept before starting. Your portal shows only your profile, radar and modules.
3. Open Proof of Skills and complete the common cases for your track. Answer naturally, including assumptions and trade-offs.
4. Resume confirmed progress if interrupted. Ask the facilitator for recovery when needed.
5. Finish the interview and review scores, evidence citations, confidence and next steps. Minimum coverage must be defined by the versioned case bank.
6. Open the automatically assigned learning module and submit a response to its short challenge; review feedback and completion status.
7. Answer the optional usefulness question. It does not affect your evaluation or access to learning.

## Facilitator CSV Import

Open the `Piloto Itti` tab in the MVP dashboard and paste a CSV with this header:

```csv
email,current_seniority,target_seniority,tech_track
ana.gomez@itti.digital,JUNIOR_2,MID_2,BACKEND_NODE
bruno.rios@itti.digital,MID_1,SENIOR_1,FULLSTACK
```

Allowed values:

- `current_seniority` and `target_seniority`: `JUNIOR_1`, `JUNIOR_2`, `MID_1`, `MID_2`, `SENIOR_1`
- `tech_track`: `BACKEND_NODE`, `FRONTEND_REACT`, `FULLSTACK`

The import is deterministic: valid rows are created or updated, invalid rows are reported by row number, and one bad row does not block the rest of the cohort.

## Success Metrics

- 20 invited collaborators
- At least 16 unique participants with a completed Proof of Skills interview out of 20 invited; repeated attempts do not increase the numerator
- Less than 10% of started attempts fail due to technical errors; report recovered attempts and affected people separately
- At least 16 of the 20 invited participants answer “Sí” to the usefulness question; also show usefulness among respondents and response coverage, with counts and denominators
- Every completed session produces a stored `evaluation_signals` row
- Every critical gap produces an automatically assigned module or a visible, recoverable generation failure; all generation failures must be resolved for acceptance

## Operational Risks

- LLM response latency or schema failures
- Prompt quality inconsistency across tracks
- Participants treating the assessment as a pass/fail exam instead of development evidence
- Missing audit/export view for People or Engineering leaders
- Manual registration does not scale beyond the pilot

## Remaining MVP Acceptance

- Validate existing local authentication, role/tenant boundaries and persistent-session behavior in staging.
- Complete failed-session recovery and facilitator reopening, automatic learning with challenge submission, explainable radar and comparable case bank with reviewed reference transcripts.
- Add facilitator actions/executive reporting, consent, cost limits and usefulness capture.
- Preserve the CSV as a reconciled backup to the executive summary.
- See `MVP_ACCEPTANCE.md` for acceptance tests and sequencing. A broader human review workflow remains a later platform capability; pilot participants need a named contact for questions about their results.
