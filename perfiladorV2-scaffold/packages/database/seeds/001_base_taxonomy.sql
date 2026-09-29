INSERT INTO organizations (name, slug)
VALUES
  ('ueno bank', 'ueno-bank'),
  ('itti Digital', 'itti'),
  ('kaitel Paraguay', 'kaitel')
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    updated_at = now();

INSERT INTO skill_taxonomy (skill_key, display_name, domain, description, rubric_levels)
VALUES
  (
    'CLEAN_ARCHITECTURE',
    'Clean Architecture',
    'Architecture',
    'Designs modular boundaries, keeps domain logic isolated, and applies dependency inversion pragmatically.',
    '{"1":"Tangled responsibilities and framework-coupled domain logic","3":"Mostly separated layers with occasional leakage","5":"Clear boundaries, testable core, and pragmatic dependency direction"}'::jsonb
  ),
  (
    'SYSTEM_DESIGN_SCALABILITY',
    'System Design & Scalability',
    'Architecture',
    'Reasons about scale, trade-offs, data ownership, failure modes, and operational constraints.',
    '{"1":"Proposes single-node or vague designs","3":"Covers basic scaling and persistence trade-offs","5":"Models load, consistency, resilience, observability, and cost trade-offs"}'::jsonb
  ),
  (
    'SQL_OPTIMIZATION_CONCURRENCY',
    'SQL Optimization & Concurrency',
    'Backend',
    'Uses transactions, locking, indexing, query plans, and isolation levels to protect data correctness and performance.',
    '{"1":"Unsafe string SQL or non-atomic updates","3":"Uses parameterized queries and basic transactions","5":"Handles isolation, locks, indexes, and contention deliberately"}'::jsonb
  ),
  (
    'OWASP_INPUT_VALIDATION',
    'OWASP Input Validation',
    'Security',
    'Prevents injection and unsafe input paths with validation, encoding, and least privilege.',
    '{"1":"Trusts raw input or concatenates untrusted data","3":"Validates common cases and parameterizes queries","5":"Applies layered validation, safe encoding, and abuse-case thinking"}'::jsonb
  ),
  (
    'TESTING_STRATEGY',
    'Testing Strategy',
    'Quality',
    'Balances unit, integration, contract, and edge-case tests around business risk.',
    '{"1":"Little or no meaningful coverage","3":"Covers happy paths and important edge cases","5":"Risk-based test pyramid with deterministic integration and regression coverage"}'::jsonb
  ),
  (
    'OBSERVABILITY_INCIDENTS',
    'Observability & Incidents',
    'Operations',
    'Designs logs, metrics, traces, alerts, and incident feedback loops for production systems.',
    '{"1":"Debugs mostly by logs after failures","3":"Adds useful metrics and basic alerts","5":"Defines SLOs, traces critical flows, and improves systems after incidents"}'::jsonb
  ),
  (
    'API_CONTRACTS',
    'API Contracts',
    'Backend',
    'Designs stable API boundaries with validation, versioning, compatibility, and useful errors.',
    '{"1":"Breaks clients with ad-hoc payloads","3":"Documents and validates core contracts","5":"Versioned contracts with compatibility and consumer-aware error design"}'::jsonb
  ),
  (
    'CODE_REVIEW_RIGOR',
    'Code Review Rigor',
    'Collaboration',
    'Reviews code for correctness, maintainability, security, tests, and architectural fit.',
    '{"1":"Reviews mostly style or approves superficially","3":"Finds correctness and maintainability issues","5":"Surfaces systemic risks and teaches through clear, actionable feedback"}'::jsonb
  )
ON CONFLICT (skill_key) DO UPDATE
SET display_name = EXCLUDED.display_name,
    domain = EXCLUDED.domain,
    description = EXCLUDED.description,
    rubric_levels = EXCLUDED.rubric_levels,
    updated_at = now();

INSERT INTO seniority_benchmarks (skill_key, track, seniority_level, required_score)
SELECT skill_key, track, seniority_level, required_score
FROM (
  VALUES
    ('CLEAN_ARCHITECTURE', 'BACKEND_NODE', 'JUNIOR_2', 2.40),
    ('CLEAN_ARCHITECTURE', 'BACKEND_NODE', 'MID_1', 3.10),
    ('CLEAN_ARCHITECTURE', 'BACKEND_NODE', 'MID_2', 3.60),
    ('CLEAN_ARCHITECTURE', 'BACKEND_NODE', 'SENIOR_1', 4.20),
    ('SYSTEM_DESIGN_SCALABILITY', 'BACKEND_NODE', 'JUNIOR_2', 2.20),
    ('SYSTEM_DESIGN_SCALABILITY', 'BACKEND_NODE', 'MID_1', 3.00),
    ('SYSTEM_DESIGN_SCALABILITY', 'BACKEND_NODE', 'MID_2', 3.70),
    ('SYSTEM_DESIGN_SCALABILITY', 'BACKEND_NODE', 'SENIOR_1', 4.30),
    ('SQL_OPTIMIZATION_CONCURRENCY', 'BACKEND_NODE', 'JUNIOR_2', 2.50),
    ('SQL_OPTIMIZATION_CONCURRENCY', 'BACKEND_NODE', 'MID_1', 3.20),
    ('SQL_OPTIMIZATION_CONCURRENCY', 'BACKEND_NODE', 'MID_2', 3.80),
    ('SQL_OPTIMIZATION_CONCURRENCY', 'BACKEND_NODE', 'SENIOR_1', 4.40),
    ('OWASP_INPUT_VALIDATION', 'BACKEND_NODE', 'JUNIOR_2', 2.60),
    ('OWASP_INPUT_VALIDATION', 'BACKEND_NODE', 'MID_1', 3.20),
    ('OWASP_INPUT_VALIDATION', 'BACKEND_NODE', 'MID_2', 3.70),
    ('OWASP_INPUT_VALIDATION', 'BACKEND_NODE', 'SENIOR_1', 4.30),
    ('TESTING_STRATEGY', 'BACKEND_NODE', 'JUNIOR_2', 2.40),
    ('TESTING_STRATEGY', 'BACKEND_NODE', 'MID_1', 3.10),
    ('TESTING_STRATEGY', 'BACKEND_NODE', 'MID_2', 3.70),
    ('TESTING_STRATEGY', 'BACKEND_NODE', 'SENIOR_1', 4.20),
    ('OBSERVABILITY_INCIDENTS', 'BACKEND_NODE', 'JUNIOR_2', 2.00),
    ('OBSERVABILITY_INCIDENTS', 'BACKEND_NODE', 'MID_1', 2.80),
    ('OBSERVABILITY_INCIDENTS', 'BACKEND_NODE', 'MID_2', 3.40),
    ('OBSERVABILITY_INCIDENTS', 'BACKEND_NODE', 'SENIOR_1', 4.10),
    ('API_CONTRACTS', 'BACKEND_NODE', 'JUNIOR_2', 2.50),
    ('API_CONTRACTS', 'BACKEND_NODE', 'MID_1', 3.20),
    ('API_CONTRACTS', 'BACKEND_NODE', 'MID_2', 3.70),
    ('API_CONTRACTS', 'BACKEND_NODE', 'SENIOR_1', 4.20),
    ('CODE_REVIEW_RIGOR', 'BACKEND_NODE', 'JUNIOR_2', 2.30),
    ('CODE_REVIEW_RIGOR', 'BACKEND_NODE', 'MID_1', 3.00),
    ('CODE_REVIEW_RIGOR', 'BACKEND_NODE', 'MID_2', 3.50),
    ('CODE_REVIEW_RIGOR', 'BACKEND_NODE', 'SENIOR_1', 4.10)
) AS source(skill_key, track, seniority_level, required_score)
ON CONFLICT (skill_key, track, seniority_level) DO UPDATE
SET required_score = EXCLUDED.required_score,
    updated_at = now();

INSERT INTO seniority_benchmarks (skill_key, track, seniority_level, required_score)
SELECT seniority_benchmarks.skill_key, tracks.track, seniority_benchmarks.seniority_level, LEAST(seniority_benchmarks.required_score + 0.10, 5.00)
FROM seniority_benchmarks
CROSS JOIN (VALUES ('FULLSTACK'), ('FRONTEND_REACT')) AS tracks(track)
WHERE seniority_benchmarks.track = 'BACKEND_NODE'
ON CONFLICT (skill_key, track, seniority_level) DO UPDATE
SET required_score = EXCLUDED.required_score,
    updated_at = now();
