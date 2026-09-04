-- ============================================================================
-- BACKUP / ROLLBACK previo a 20260826_cognitive_rehab.sql
--
-- ESTADO CAPTURADO (baseline vivo, 26-ago-2026):
--   cognitive_exercises / user_exercise_sessions .. NO existen
--   profiles.birthdate / cognitive_terms_accepted_at .. NO existen
--   enums exercise_* .. NO existen
--   tablas 42 · RLS 38 · políticas 108 · enums 20
--   huella POL .. b48dad24d8f7fb9580f42516ec64d150
--   huella ACL .. 6768c3c964df7a34a5acabb606366001
--
-- Rollback: DROP en orden inverso de dependencias + DROP de las columnas y enums.
-- (El GRANT por columna desaparece con la columna.)
-- ============================================================================

BEGIN;

DROP TABLE IF EXISTS public.user_exercise_sessions;
DROP TABLE IF EXISTS public.cognitive_exercises;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS cognitive_terms_accepted_at;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS birthdate;
DROP TYPE IF EXISTS public.exercise_difficulty;
DROP TYPE IF EXISTS public.exercise_age_band;
DROP TYPE IF EXISTS public.exercise_game_kind;

COMMIT;

-- ============================================================================
-- REGLA 1 — el catálogo demuestra el estado restaurado (= baseline)
-- ============================================================================
SELECT
  (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('cognitive_exercises','user_exercise_sessions')) AS tablas_nuevas,
  (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name IN ('birthdate','cognitive_terms_accepted_at')) AS cols_profiles,
  (SELECT count(*) FROM pg_type WHERE typname IN ('exercise_game_kind','exercise_age_band','exercise_difficulty')) AS enums_nuevos,
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r') AS tablas_base,
  (SELECT count(*) FROM pg_policies WHERE schemaname='public') AS politicas_total,
  (SELECT md5(string_agg(schemaname||tablename||policyname||cmd||coalesce(qual,'')||coalesce(with_check,''),'|' ORDER BY tablename,policyname)) FROM pg_policies WHERE schemaname='public') AS huella_pol,
  (SELECT md5(string_agg(c.relname||':'||coalesce(array_to_string(c.relacl,','),'-'),'|' ORDER BY c.relname)) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r') AS huella_acl_global;
