-- ============================================================================
-- R4 — cierra H-JE-001: journey_events, TRUNCATE de service_role salta el
-- append-only.
--
-- QUÉ CIERRA, medido en el diagnóstico de seguridad post-RLS (14-ago) y
-- reconfirmado el 18-ago:
--
--   El trigger enforce_journey_event_append_only es FOR EACH ROW, así que un
--   DELETE/UPDATE fila a fila da P0001 JOURNEY_EVENT_APPEND_ONLY. Pero TRUNCATE
--   NO dispara triggers de fila, y service_role conservaba `D` (TRUNCATE) en la
--   ACL. Resultado medido: service_role vació las 58 filas de un golpe saltando
--   el append-only.
--
--     service_role DELETE 1 fila ... P0001 JOURNEY_EVENT_APPEND_ONLY   [trigger]
--     service_role TRUNCATE ........ EJECUTADO, 58 -> 0                <<< brecha
--
-- SOLUCIÓN — una sola sentencia, la mínima superficie:
--
--   REVOKE TRUNCATE ON public.journey_events FROM service_role;
--
--   Se descartó un trigger BEFORE TRUNCATE (defensa en profundidad): el REVOKE
--   ya cierra la vía, y un trigger nuevo cambiaría la huella de triggers y sería
--   más difícil de revertir limpio. Decisión aprobada.
--
-- QUÉ NO TOCA:
--   El DELETE/UPDATE fila a fila sigue cerrado por el trigger append-only
--   —esta migración no lo modifica—. `postgres` conserva TRUNCATE (lo necesita
--   para operaciones legítimas de mantenimiento). `anon` y `authenticated` ya
--   habían perdido TRUNCATE en 20260804d. Ningún consumidor legítimo hace
--   TRUNCATE (verificado en src/, Edge Functions, scripts y migraciones).
--
--   service_role pasa de `arwdDxtm` a `arwdxtm` (solo cae la D). No se toca RLS,
--   FORCE, triggers, funciones, FK, índices, datos ni ninguna otra tabla.
--
-- Backup: supabase/backups/20260818_pre_je_revoke_truncate.sql
-- Diagnóstico: contexto-proyecto/auditorias-tecnicas/Diagnostico_Seguridad_Post_RLS_2026-08-14.md
--
-- Idempotente: REVOKE sobre un privilegio ya revocado no falla ni cambia nada.
-- ============================================================================

BEGIN;

REVOKE TRUNCATE ON TABLE public.journey_events FROM service_role;

COMMIT;

-- ============================================================================
-- REGLA 1 — el catálogo demuestra el estado final
-- ============================================================================
SELECT
  (SELECT array_to_string(relacl, ', ') FROM pg_class
     WHERE oid = 'public.journey_events'::regclass)                      AS acl_literal,
  (SELECT CASE WHEN has_table_privilege('service_role','public.journey_events','TRUNCATE')
            THEN 'D presente <<< NO se revocó' ELSE 'D ausente (revocado)' END) AS service_role_truncate,
  (SELECT CASE WHEN has_table_privilege('service_role','public.journey_events','DELETE')
            THEN 'd presente' ELSE 'd ausente <<<' END)                  AS service_role_delete,
  (SELECT CASE WHEN has_table_privilege('service_role','public.journey_events','INSERT')
            THEN 'a presente' ELSE 'a ausente <<<' END)                  AS service_role_insert,
  (SELECT CASE WHEN has_table_privilege('postgres','public.journey_events','TRUNCATE')
            THEN 'D presente (intacto)' ELSE 'D ausente <<<' END)        AS postgres_truncate,
  (SELECT count(*) FROM public.journey_events)                           AS filas,
  (SELECT relrowsecurity FROM pg_class
     WHERE oid = 'public.journey_events'::regclass)                      AS rls,
  (SELECT count(*) FROM pg_trigger
     WHERE tgrelid = 'public.journey_events'::regclass
       AND NOT tgisinternal)                                            AS triggers,
  (SELECT md5(string_agg(c.relname||':'||coalesce(array_to_string(c.relacl,','),'-'),'|' ORDER BY c.relname))
     FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r')                          AS huella_acl_global,
  (SELECT md5(string_agg(c.relname||':'||tg.tgname||':'||pg_get_triggerdef(tg.oid),'|' ORDER BY c.relname,tg.tgname))
     FROM pg_trigger tg JOIN pg_class c ON c.oid=tg.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND NOT tg.tgisinternal)                    AS huella_triggers,
  (SELECT count(*) FROM pg_policies WHERE schemaname='public')           AS politicas_public;
