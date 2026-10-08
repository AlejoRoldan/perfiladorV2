-- Bloquea el acceso a estas tablas por la API publica de Supabase (roles anon y authenticated).
-- No se crean politicas a proposito: la app se conecta directo a Postgres como duena de las tablas
-- y no se ve afectada por RLS.
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE developers ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_taxonomy ENABLE ROW LEVEL SECURITY;
ALTER TABLE seniority_benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE developer_skill_matrix ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS schema_migrations ENABLE ROW LEVEL SECURITY;
