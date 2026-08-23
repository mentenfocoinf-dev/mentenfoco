-- ============================================================================
-- BACKUP / ROLLBACK previo a 20260821_b2b_companies.sql (Sprint B2B)
--
-- ESTADO CAPTURADO (baseline vivo, 21-ago-2026):
--   companies / company_members / employer_link_consents .. NO existen
--   company_aggregate_metrics ............................. NO existe
--   enums company_status / company_member_status .......... NO existen
--   tablas 39 · RLS 35 · políticas 102 · funciones 274 · enums 18
--   huella POL ....... 3974d052ca59223e2eebb5d3981395e6
--   huella ACL ....... 82e5ce2f51cf3eefffbaf3f1be95aa85
--
-- Migración ADITIVA pura. Rollback = DROP en orden inverso de dependencias
-- (company_members → employer_link_consents → companies → función → enums).
-- ============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.company_aggregate_metrics(uuid);
DROP TABLE IF EXISTS public.company_members;
DROP TABLE IF EXISTS public.employer_link_consents;
DROP TABLE IF EXISTS public.companies;
DROP TYPE IF EXISTS public.company_member_status;
DROP TYPE IF EXISTS public.company_status;

COMMIT;

-- ============================================================================
-- REGLA 1 — el catálogo demuestra el estado restaurado (= baseline)
-- ============================================================================
SELECT
  (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('companies','company_members','employer_link_consents')) AS tablas_b2b,
  (SELECT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND proname='company_aggregate_metrics')) AS funcion_existe,
  (SELECT count(*) FROM pg_type WHERE typname IN ('company_status','company_member_status')) AS enums_b2b,
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r') AS tablas_base,
  (SELECT count(*) FROM pg_policies WHERE schemaname='public') AS politicas_total,
  (SELECT md5(string_agg(schemaname||tablename||policyname||cmd||coalesce(qual,'')||coalesce(with_check,''),'|' ORDER BY tablename,policyname)) FROM pg_policies WHERE schemaname='public') AS huella_pol,
  (SELECT md5(string_agg(c.relname||':'||coalesce(array_to_string(c.relacl,','),'-'),'|' ORDER BY c.relname)) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r') AS huella_acl_global;
