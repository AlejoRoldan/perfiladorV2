---
name: perfilador-corporate-pilot
description: Use when improving PerfiladorV2 for a corporate pilot with Itti collaborators, especially changes involving LLM scoring, Proof of Skills interviews, generated L&D modules, cohort readiness, evaluation quality, security, or production hardening.
---

# Perfilador Corporate Pilot

Use this skill to keep PerfiladorV2 changes aligned with a controlled, corporate-grade pilot.

## Operating Principles

- Treat the current system as an LLM assessment product, not a demo script.
- Prefer fixed workflows over autonomous agents unless the task truly requires planning, tool choice, or multi-step recovery.
- Every LLM response consumed by code must have a schema, validation, and explicit failure behavior.
- Every prompt/model/rubric change should be evaluated against a small regression set before being presented as better.
- Preserve participant trust: clear instructions, no surprise data exposure, no hidden pass/fail framing.
- Preserve auditability: store the rubric version, model, prompt family, timestamp, source type, and scoring rationale.

## Coordinated External Skills

When the external skill pack is available, use these in this order:

1. `agent-vs-workflow-decision`
   Use before introducing new agent loops. Default to deterministic workflows for registration, scoring persistence, reporting, and cohort management.

2. `structured-output`
   Use for Gemini responses that become database rows, radar scores, module definitions, or admin reports.

3. `tool-design`
   Use when exposing internal operations to an agent or future admin assistant, such as registering participants, creating cohorts, or exporting reports.

4. `model-selection`
   Use before changing Gemini model names, adding fallback models, or deciding which model powers interviews vs. judge/eval tasks.

5. `evals-before-shipping`
   Use before claiming an assessment/rubric/prompt change improved quality.

## Pilot Readiness Checklist

- Secrets are out of tracked files.
- Database setup is reproducible with `pnpm db:setup`.
- Participants can be registered without manual SQL.
- Each Proof of Skills session stores evidence in `evaluation_signals`.
- Each score has a human-readable rationale.
- UI errors are actionable and do not expose stack traces or raw provider failures.
- A facilitator can see cohort completion state.
- Pilot instructions explain that results are developmental evidence, not a disciplinary exam.

## Change Workflow

1. Identify which part of the pilot the change affects: onboarding, interview, scoring, L&D generation, reporting, or operations.
2. Check whether the change modifies prompts, schemas, model choice, or rubric interpretation.
3. If it does, add or update at least one fixture/test case before changing behavior.
4. Keep schema and DB changes versioned.
5. Run static checks and any relevant smoke test.
6. Update `docs/ITTI_PILOT_PLAN.md` or add an operational note if the pilot process changes.

## Success Criteria

A change is corporate-pilot ready when:

- It is reproducible from a fresh checkout.
- It has clear operational instructions.
- It fails safely.
- It preserves or improves auditability.
- It does not require a developer to hand-edit production data.
