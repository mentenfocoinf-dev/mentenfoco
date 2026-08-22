-- ============================================================================
-- BACKUP / ROLLBACK previo a 20260820_signup_rate_limit.sql   (R3 backend)
--
-- ESTADO CAPTURADO (baseline vivo de R3, 20-ago-2026):
--   tabla public.signup_rate_limit ............ NO existe
--   función public.enforce_signup_rate_limit .. NO existe
--   tablas base public ........................ 37   (RLS 33/37)
--   políticas public .......................... 98
--   funciones public .......................... 273
--   huella FUNCTIONS .......................... 56046fffb5f9ee58ea9e97d24e9c1df4
--   huella ACL global ......................... 2cde6e70ae1419fd5b99dbdecb4918fe
--
-- La migración es puramente ADITIVA: crea una tabla y una función nuevas, no
-- toca ningún objeto existente. Por eso el rollback es DROP de ambas y deja la
-- base EXACTAMENTE en el baseline de arriba (huellas idénticas).
-- ============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.enforce_signup_rate_limit(text);
DROP TABLE IF EXISTS public.signup_rate_limit;

COMMIT;

-- ============================================================================
-- REGLA 1 — el catálogo demuestra el estado restaurado (= baseline)
-- ============================================================================
SELECT
  (SELECT EXISTS(SELECT 1 FROM information_schema.tables
     WHERE table_schema='public' AND table_name='signup_rate_limit'))       AS tabla_existe,
  (SELECT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname='enforce_signup_rate_limit'))   AS funcion_existe,
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relkind='r')                            AS tablas_base,
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity)       AS tablas_con_rls,
  (SELECT md5(string_agg(pp.proname||':'||md5(pp.prosrc),'|' ORDER BY pp.proname,pp.oid))
     FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace
     WHERE nn.nspname='public')                                             AS huella_functions,
  (SELECT md5(string_agg(c.relname||':'||coalesce(array_to_string(c.relacl,','),'-'),'|' ORDER BY c.relname))
     FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relkind='r')                            AS huella_acl_global;
