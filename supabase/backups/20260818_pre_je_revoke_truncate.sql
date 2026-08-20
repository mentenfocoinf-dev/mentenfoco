-- ============================================================================
-- BACKUP previo a 20260818_je_revoke_truncate.sql   (R4 — cierra H-JE-001)
--
-- Estado de los privilegios de public.journey_events el 18 de agosto de 2026,
-- ANTES de revocar TRUNCATE a service_role. Leído del catálogo (pg_class.relacl,
-- has_table_privilege), no de memoria.
--
-- ESTADO CAPTURADO (baseline vivo de R4):
--   RLS global 33/37 · FORCE 0/37 · políticas 98
--   journey_events: 58 filas · 2 triggers propios
--   ACL literal:
--     postgres=arwdDxtm/postgres, anon=axtm/postgres,
--     authenticated=am/postgres, service_role=arwdDxtm/postgres
--
--   service_role tiene D (TRUNCATE) — es lo único que la migración quita.
--   Tras el REVOKE, service_role pasará de `arwdDxtm` a `arwdxtm`.
--
--   Huellas globales vivas:
--     ACL ......... d3ca583b100fbe4a3af7dfa65297b607
--     TRIGGERS .... 3ca1288a327c51ad66d698009c86eb79
--     FUNCTIONS ... e5e288e79a4b6f5b9364d7ffe902b7e1
--
-- QUÉ HACE ESTE ROLLBACK: devuelve a service_role el privilegio TRUNCATE, y
-- nada más. No toca `postgres`, `anon`, `authenticated`, ni ningún otro
-- privilegio de service_role. No toca triggers, funciones, RLS, datos ni FORCE.
--
-- Por qué NO se restaura con `GRANT ALL`: service_role NO pierde nada salvo D;
-- reponer solo D es exacto y evita conceder de más.
-- ============================================================================

BEGIN;

GRANT TRUNCATE ON TABLE public.journey_events TO service_role;

COMMIT;

-- ============================================================================
-- REGLA 1 — el catálogo demuestra el estado restaurado
-- ============================================================================
SELECT
  (SELECT array_to_string(relacl, ', ') FROM pg_class
     WHERE oid = 'public.journey_events'::regclass)                      AS acl_literal,
  (SELECT CASE WHEN has_table_privilege('service_role','public.journey_events','TRUNCATE')
            THEN 'D presente (restaurado)' ELSE 'D ausente <<<' END)      AS service_role_truncate,
  (SELECT count(*) FROM public.journey_events)                           AS filas,
  (SELECT relrowsecurity FROM pg_class
     WHERE oid = 'public.journey_events'::regclass)                      AS rls,
  (SELECT count(*) FROM pg_trigger
     WHERE tgrelid = 'public.journey_events'::regclass
       AND NOT tgisinternal)                                            AS triggers,
  (SELECT md5(string_agg(c.relname||':'||coalesce(array_to_string(c.relacl,','),'-'),'|' ORDER BY c.relname))
     FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r')                          AS huella_acl_global;
