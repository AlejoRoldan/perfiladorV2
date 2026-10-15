# Itti Pilot Plan

Objective: run a controlled Proof of Skills pilot with 20 Itti collaborators, validate the assessment experience, and collect enough evidence to decide what to harden next.

## Pilot Scope

- Organization: itti Digital (`itti`)
- Cohort size: 20 collaborators
- Tracks: Backend Node.js, Fullstack, Frontend React
- Duration: 1 week
- Primary flow: register collaborator, run Proof of Skills interview, generate skill radar, assign L&D module when a gap is found

## Readiness Checklist

- Secrets live only in `.env`; `.env.example` has placeholders.
- Database schema and seed are applied with `pnpm db:setup`.
- Skills workflow is documented in `docs/SKILLS_INTEGRATION.md`.
- Project-local coordination skill exists at `.agents/skills/perfilador-corporate-pilot/SKILL.md`.
- Dashboard runs with `node dashboard.mjs` on `http://localhost:3005`.
- Pilot participants are registered with corporate emails.
- One support channel is defined for access issues and feedback.
- A rollback plan exists: stop the dashboard process and preserve DB backup/export.

## Participant Instructions

1. Access the dashboard URL shared by the facilitator.
2. Select your collaborator profile or register with your Itti email.
3. Open Proof of Skills.
4. Answer naturally, including assumptions and trade-offs.
5. Finish and certify after at least one technical answer.
6. Review the radar and assigned L&D module.
7. Share feedback on clarity, fairness, and usefulness.

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
- At least 16 completed Proof of Skills sessions
- Less than 10% failed sessions due to technical errors
- At least 80% of participants rate the experience as useful
- Every completed session produces a stored `evaluation_signals` row
- Every critical gap produces a clear L&D recommendation

## Operational Risks

- LLM response latency or schema failures
- Prompt quality inconsistency across tracks
- Participants treating the assessment as a pass/fail exam instead of development evidence
- Missing audit/export view for People or Engineering leaders
- Manual registration does not scale beyond the pilot

## Next Hardening Targets

- Authentication and role-based access
- Admin cohort management for Itti
- Participant invitation links
- Exportable pilot report
- Deterministic challenge bank per track
- Human review workflow for disputed evaluations
