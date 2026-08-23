-- ============================================================================
-- BACKUP / ROLLBACK previo a 20260821_journal_entries.sql (Item 1 — journaling)
--
-- ESTADO CAPTURADO (baseline vivo, 21-ago-2026):
--   tabla public.journal_entries ..... NO existe
--   tablas base public ............... 38   (RLS 34/38)
--   políticas public ................. 98
--   funciones public ................. 274
--   huella POL ....................... 772a619355e540d5f370554a998bb543
--   huella ACL global ................ 74141c34c9103f2b693647a10ac917e7
--
-- Migración ADITIVA pura (crea una tabla nueva, no toca nada existente). El
-- rollback es DROP y deja la base EXACTAMENTE en el baseline.
-- ============================================================================

BEGIN;

DROP TABLE IF EXISTS public.journal_entries;  -- CASCADE innecesario: nadie la referencia

COMMIT;

-- ============================================================================
-- REGLA 1 — el catálogo demuestra el estado restaurado (= baseline)
-- ============================================================================
SELECT
  (SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='journal_entries')) AS tabla_existe,
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r') AS tablas_base,
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity) AS tablas_con_rls,
  (SELECT count(*) FROM pg_policies WHERE schemaname='public') AS politicas_total,
  (SELECT md5(string_agg(schemaname||tablename||policyname||cmd||coalesce(qual,'')||coalesce(with_check,''),'|' ORDER BY tablename,policyname)) FROM pg_policies WHERE schemaname='public') AS huella_pol,
  (SELECT md5(string_agg(c.relname||':'||coalesce(array_to_string(c.relacl,','),'-'),'|' ORDER BY c.relname)) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r') AS huella_acl_global;
