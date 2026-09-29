CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS developers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  github_username text,
  current_seniority text NOT NULL,
  target_seniority text NOT NULL,
  tech_track text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS skill_taxonomy (
  skill_key text PRIMARY KEY,
  display_name text NOT NULL,
  domain text NOT NULL,
  description text NOT NULL DEFAULT '',
  rubric_levels jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS seniority_benchmarks (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  skill_key text NOT NULL REFERENCES skill_taxonomy(skill_key) ON DELETE CASCADE,
  track text NOT NULL,
  seniority_level text NOT NULL,
  required_score numeric(3,2) NOT NULL CHECK (required_score >= 1 AND required_score <= 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (skill_key, track, seniority_level)
);

CREATE TABLE IF NOT EXISTS developer_skill_matrix (
  developer_id uuid NOT NULL REFERENCES developers(id) ON DELETE CASCADE,
  skill_key text NOT NULL REFERENCES skill_taxonomy(skill_key) ON DELETE CASCADE,
  current_score numeric(3,2) NOT NULL DEFAULT 1.00 CHECK (current_score >= 0 AND current_score <= 5),
  confidence_score numeric(3,2) NOT NULL DEFAULT 0.50 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  last_signal_at timestamptz,
  gap_vs_target numeric(4,2) NOT NULL DEFAULT 0.00,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (developer_id, skill_key)
);

CREATE TABLE IF NOT EXISTS evaluation_signals (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  developer_id uuid NOT NULL REFERENCES developers(id) ON DELETE CASCADE,
  source_type text NOT NULL,
  external_ref text NOT NULL,
  diff_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_evaluations jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS learning_modules (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  developer_id uuid NOT NULL REFERENCES developers(id) ON DELETE CASCADE,
  skill_key text NOT NULL REFERENCES skill_taxonomy(skill_key) ON DELETE CASCADE,
  title text NOT NULL,
  content_blocks jsonb NOT NULL DEFAULT '{}'::jsonb,
  interactive_challenge jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'ASSIGNED' CHECK (status IN ('ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED')),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_developers_org_id ON developers(org_id);
CREATE INDEX IF NOT EXISTS idx_developers_email ON developers(email);
CREATE INDEX IF NOT EXISTS idx_skill_taxonomy_domain ON skill_taxonomy(domain);
CREATE INDEX IF NOT EXISTS idx_benchmarks_lookup ON seniority_benchmarks(track, seniority_level, skill_key);
CREATE INDEX IF NOT EXISTS idx_skill_matrix_developer ON developer_skill_matrix(developer_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_signals_developer_created ON evaluation_signals(developer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_modules_developer_status ON learning_modules(developer_id, status, created_at DESC);
