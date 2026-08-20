-- ============================================================================
-- BACKUP DE REVERSION · Grupo 1 — primera activacion de RLS
-- Fecha: 12 de agosto de 2026
--
-- Revierte por completo la migracion `20260812_grupo1_rls.sql`, que activa RLS
-- en DOS tablas y crea CINCO politicas. Nada mas se toca en ese sprint.
--
-- ── Estado capturado del catalogo ANTES de la migracion ─────────────────────
--
-- Leido de `pg_class` y `pg_policies`, no transcrito a mano:
--
--   public.mood_entries
--     relrowsecurity      = false
--     relforcerowsecurity = false
--     politicas definidas = 0
--     relacl = {postgres=arwdDxtm/postgres,
--               authenticated=arwm/postgres,
--               service_role=arwdDxtm/postgres}
--
--   public.service_requests
--     relrowsecurity      = false
--     relforcerowsecurity = false
--     politicas definidas = 0
--     relacl = {postgres=arwdDxtm/postgres,
--               anon=m/postgres,
--               authenticated=arwm/postgres,
--               service_role=arwdDxtm/postgres}
--
-- Ninguna de las dos tenia politicas: por eso esta reversion solo necesita
-- borrar las cinco que crea la migracion, sin recrear ninguna.
--
-- Nota sobre `anon=m` en `service_requests`: es MAINTAIN, no da acceso a
-- datos. Los cuatro privilegios DML de `anon` estan a cero en ambas tablas.
--
-- ── Huellas del esquema en el momento del backup ────────────────────────────
--
--   ACL de las 37 tablas .. 64cdb69b1241ea34ac996556da08dc19
--   42 triggers ........... 217dffa660659d3cf920f78d1ca5f344
--   62 foreign keys ....... b9087924187f648a75b1677f7e8cd3ea
--   274 funciones ......... a093e1446067405c4d51432b46e6f543
--   46 politicas .......... e5179e392909950b0ca3c8065da99465
--   RLS ................... 0 de 37 tablas
--
-- Filas: mood_entries 1 · service_requests 1 · content_items 26 ·
-- clinical_prescriptions 14 · blog_comments 2 · public_test_submissions 5 ·
-- profiles 8 · therapy_sessions 21 · clinical_consents 2
--
-- ── Que NO hace este archivo ────────────────────────────────────────────────
--
-- No toca ACL, triggers, FK, funciones, RPC, columnas, indices ni datos.
-- No toca las otras 35 tablas. Revertir devuelve las dos tablas al estado de
-- antes: sin RLS y sin politicas, exactamente como estaban.
--
-- ── Idempotencia ────────────────────────────────────────────────────────────
--
-- `DROP POLICY IF EXISTS` no falla si la politica ya no esta, y
-- `DISABLE ROW LEVEL SECURITY` sobre una tabla con RLS ya apagado tampoco.
-- Ejecutable las veces que haga falta.
-- ============================================================================

-- ─── Reversion ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Patients read their own mood entries"   ON public.mood_entries;
DROP POLICY IF EXISTS "Patients create their own mood entries" ON public.mood_entries;
DROP POLICY IF EXISTS "Patients update their own mood entries" ON public.mood_entries;

DROP POLICY IF EXISTS "Patients read their own service requests"   ON public.service_requests;
DROP POLICY IF EXISTS "Patients create their own service requests" ON public.service_requests;

ALTER TABLE public.mood_entries     DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_requests DISABLE ROW LEVEL SECURITY;

-- ─── Comprobacion posterior a la reversion ──────────────────────────────────
--
-- SELECT relname, relrowsecurity, relforcerowsecurity
--   FROM pg_class
--  WHERE oid IN ('public.mood_entries'::regclass, 'public.service_requests'::regclass);
--   -> ambas false, false
--
-- SELECT count(*) FROM pg_policies
--  WHERE schemaname = 'public' AND tablename IN ('mood_entries','service_requests');
--   -> 0
--
-- SELECT count(*) FROM pg_class
--  WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' AND relrowsecurity;
--   -> 0 de 37
