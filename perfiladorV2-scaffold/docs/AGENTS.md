# Agent Catalog

This document defines every current and planned agent in TechProfiler. It is the reviewer-facing contract for what each agent does, what it must not do, and how its output becomes product evidence.

## 1. Agent Design Rules

All agents must follow these rules:

- Sanitize code, diffs, PR context, and review comments before any external model call.
- Ask for structured JSON only and validate the response before use.
- Treat LLM output as untrusted until schema validation passes.
- Persist raw evidence to `evaluation_signals` before or alongside any matrix update.
- Update `developer_skill_matrix` only with canonical `skill_taxonomy.skill_key` values.
- Record audit metadata where possible: model, prompt family, schema version, rubric version, external reference, redaction count.
- Keep persistence optional for tests and local dry runs.
- Do not make promotion, compensation, or employment decisions. Agents provide evidence and recommendations, not final HR outcomes.

## 2. Current Agents

### 2.1 CodeQualityProfilerAgent

File: `apps/agents/src/code-quality-profiler.ts`

Purpose:

- Evaluate source code, patches, or PR diffs.
- Produce skill-level feedback and pattern detection.
- Persist evaluation evidence and update the skill matrix.

Inputs:

- `codeOrDiff`: source code or diff text.
- `developerInfo.email`: developer identity for persistence.
- `developerInfo.targetSeniority`: benchmark level.
- `developerInfo.techTrack`: benchmark track.
- `externalRef`: PR/challenge reference.
- `customInstructions`: optional rubric emphasis.
- `persistToDatabase`: disable for dry runs/tests.

Output:

- `summary`
- `overallScore`
- `skillEvaluations[]`
- `detectedPatterns[]`
- optional `signalId`

Persistence:

- Writes `evaluation_signals` with `sourceType = GITHUB_PR_EVALUATION`.
- Upserts `developer_skill_matrix` per skill.

Safety requirements:

- Must run `SecretSanitizer.sanitize()` before prompting.
- Must validate against `CodeQualityEvaluationSchema`.
- Must normalize or reject unknown skill keys before persistence.

Known improvement:

- Align prompt skill keys with canonical taxonomy. For example, prefer `SQL_OPTIMIZATION_CONCURRENCY` over non-canonical concurrency aliases unless an alias map converts it before persistence.

### 2.2 ReviewerDynamicsAgent

File: `apps/agents/src/reviewer-dynamics.ts`

Purpose:

- Evaluate the quality of a developer's code review comments.
- Score pedagogy, empathy, rigor, constructiveness, and actionability.

Inputs:

- `reviewComments`: comments written by reviewer.
- `prContext`: optional sanitized PR context.
- `reviewerInfo.email`: reviewer identity for persistence.
- `reviewerInfo.targetSeniority`: benchmark level.
- `reviewerInfo.techTrack`: benchmark track.
- `externalRef`: PR/review reference.
- `persistToDatabase`: disable for dry runs/tests.

Output:

- `summary`
- `overallScore`
- `skillEvaluations[]`
- `toneAnalysis`
- `actionableSuggestionsDetected`
- `keyStrengths[]`
- `improvementAreas[]`
- optional `signalId`

Persistence:

- Writes `evaluation_signals` with `sourceType = CODE_REVIEW_SIMULATION`.
- Upserts `developer_skill_matrix` only for valid taxonomy keys.

Safety requirements:

- Sanitize comments and PR context.
- Validate against `ReviewerDynamicsEvaluationSchema`.
- Do not persist unknown skills.

Known improvement:

- Replace broad aliases with a single canonical taxonomy map owned by `packages/schemas` or `apps/agents/src/shared/taxonomy.ts`.

### 2.3 SkillSynthesizerAgent

File: `apps/agents/src/skill-synthesizer.ts`

Purpose:

- Recalculate a developer's consolidated Tech Radar from historical evaluation signals.
- Apply exponential time decay.
- Compare synthesized scores against target benchmarks.
- Generate an executive summary of progress and gaps.

Inputs:

- developer email.
- `decayRate`: optional lambda; default is `0.015`.
- `persistToDatabase`: disable for dry runs/tests.

Output:

- `developerId`
- `synthesizedAt`
- `overallTrend`
- `summary`
- `skillSynthesis[]`
- `criticalGaps[]`
- `recommendedFocus[]`

Persistence:

- Upserts `developer_skill_matrix` for each synthesized skill.

Mathematical rule:

```text
weight_i = e^(-decayRate * days_elapsed_i)
synthesized_score = sum(weight_i * score_i) / sum(weight_i)
confidence = min(0.99, 1 - e^(-0.35 * sum_weights))
```

Safety requirements:

- Ignore raw signal skills not present in `skill_taxonomy`.
- Validate final report against `SkillSynthesisReportSchema`.
- Keep quantitative synthesis deterministic; use LLM only for narrative summary.

### 2.4 CurriculumBuilderAgent

File: `apps/agents/src/curriculum-builder.ts`

Purpose:

- Generate a just-in-time learning module for a detected skill gap.
- Produce explanation, challenge scenario, starter template, and verification criteria.
- Assign the module to the developer.

Inputs:

- `email`: developer identity.
- `skillKey`: canonical target skill.
- `gapVsTarget`: optional numeric gap.
- `antipatternsFound[]`: optional recent evidence.
- `persistToDatabase`: disable for dry runs/tests.

Output:

- `title`
- `skillKey`
- `explanation`
- `challengeScenario`
- `solutionTemplate`
- `verificationCriteria[]`
- `estimatedMinutes`
- optional `moduleId`

Persistence:

- Inserts into `learning_modules`.

Safety requirements:

- Only generate modules for taxonomy-backed skills.
- Validate against `CurriculumModuleSpecSchema`.
- Store challenge content separately enough for future Monaco execution.

Known improvement:

- Populate both `content_blocks` and `interactive_challenge` consistently with the migration schema.

## 3. MVP Conversational Agent

Location: `dashboard.mjs`

Purpose:

- Conduct Proof of Skills interviews.
- Ask technical follow-up questions.
- Convert conversation transcript into final skill evaluations.

Current functions:

- `startPoS`
- `chatPoS`
- `finishPoS`

Persistence:

- Stores final verdict in `evaluation_signals` with `sourceType = CONVERSATIONAL_PROOF_OF_SKILL`.
- Updates `developer_skill_matrix`.

Safety requirements:

- Validate final model output with `posFinalEvaluationSchema`.
- Store model and prompt audit metadata.
- Keep transcript scoped to the selected developer.

Migration target:

- Move session state and persistence into `apps/api`.
- Move UI into `apps/web`.
- Reuse shared schemas from `packages/schemas`.

## 4. Planned Agents

### 4.1 InteractiveChallengeEvaluatorAgent

Purpose:

- Evaluate submitted code solutions for generated labs.
- Verify tests, edge cases, and rubric-specific competencies.

Inputs:

- module ID.
- starter challenge metadata.
- user submitted code.
- deterministic test results, when available.

Output:

- pass/fail.
- score.
- feedback.
- verified competencies.

Required behavior:

- Prefer deterministic tests over LLM judgment.
- Use LLM feedback only after tests produce evidence.
- Update module status and skill matrix after successful completion.

### 4.2 GithubIngestionAgent or Worker

Purpose:

- Normalize GitHub webhook events into internal evaluation jobs.

Inputs:

- GitHub PR, review, commit, and diff metadata.

Output:

- sanitized ingestion payload.
- queue job for code/review evaluation.

Required behavior:

- Verify HMAC signature.
- Return fast HTTP acknowledgement.
- Never send raw webhook payloads directly to an LLM.

### 4.3 ReportSynthesisAgent

Purpose:

- Generate cohort and individual summaries for pilot reporting.

Inputs:

- deterministic aggregates.
- selected evidence snippets.
- module completion status.

Output:

- executive summary.
- top cohort gaps.
- recommended L&D investment areas.
- individual development plan summaries.

Required behavior:

- Never invent scores.
- Cite stored evidence IDs or external refs.
- Distinguish observations from recommendations.

## 5. Agent Testing Requirements

Each agent needs:

- Unit tests for schema validation.
- Fixtures for valid model responses.
- Fixtures for malformed JSON.
- Fixtures for missing required fields.
- Fixtures for unknown skill keys.
- Tests for persistence disabled mode.
- Tests for redaction before prompting.
- Regression tests for scoring bands before prompt or rubric changes.

## 6. Prompt and Rubric Versioning

Every durable agent result should include:

- `promptFamily`
- `promptVersion`
- `schemaVersion`
- `rubricVersion`
- `model`
- `externalRef`
- `redactedSecrets`

These fields may live in `diff_summary.audit` or a future dedicated audit column.

## 7. Taxonomy Contract

Agents must use canonical taxonomy keys from `skill_taxonomy`. The current SQL seed defines the canonical keys:

- `CLEAN_ARCHITECTURE`
- `SYSTEM_DESIGN_SCALABILITY`
- `SQL_OPTIMIZATION_CONCURRENCY`
- `OWASP_INPUT_VALIDATION`
- `TESTING_STRATEGY`
- `OBSERVABILITY_INCIDENTS`
- `API_CONTRACTS`
- `CODE_REVIEW_RIGOR`

Any non-canonical skill returned by a model must be:

1. mapped through an explicit alias table,
2. validated against `skill_taxonomy`,
3. skipped with a warning if still unknown.
