# Skills Integration

## Selected Public Repository

Repository: `OsamaSaa3d/production-ai-skills`

URL: https://github.com/OsamaSaa3d/production-ai-skills

Why this repo:

- It focuses on production LLM engineering rather than generic coding prompts.
- It includes skills for structured output, evals, model selection, tool design, context management, RAG, and agent-vs-workflow decisions.
- These map directly to PerfiladorV2's risk areas: Gemini JSON contracts, skill scoring, generated L&D modules, prompt/rubric changes, and corporate pilot readiness.

## Clone Target

When GitHub network access is available from this machine:

```bash
git clone https://github.com/OsamaSaa3d/production-ai-skills.git vendor/production-ai-skills
```

Keep it under `vendor/` so upstream content remains clearly separated from first-party PerfiladorV2 code.

## First Skills To Use

1. `structured-output`
   Apply to Gemini responses consumed by `dashboard.mjs`, `run-pipeline.mjs`, `resolve-challenge.mjs`, and future report generation.

2. `evals-before-shipping`
   Apply before changing prompts, rubrics, model choice, or scoring behavior.

3. `agent-vs-workflow-decision`
   Apply before adding autonomous agent behavior. Most pilot operations should remain fixed workflows.

4. `tool-design`
   Apply when designing admin operations such as cohort registration, participant imports, exports, and future assistant actions.

5. `model-selection`
   Apply before introducing fallback models, judge models, or different interview/evaluation models.

## Local Coordination Skill

Project-local skill:

```text
.agents/skills/perfilador-corporate-pilot/SKILL.md
```

Use it for PerfiladorV2-specific pilot hardening. It coordinates the external skill pack with the local product goals and Itti pilot constraints.

## Current Network Note

The first clone attempt failed from the terminal with:

```text
Failed to connect to github.com port 443
```

Until network access is available, use the local coordination skill and this integration plan. Do not manually paste large external skill files into this repo; clone or install upstream content when transport is available.
