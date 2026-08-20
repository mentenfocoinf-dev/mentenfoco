-- ============================================================================
-- BACKUP DE REVERSION · Grupo 2 — segunda tanda de activacion de RLS
-- Fecha: 12 de agosto de 2026
--
-- Revierte por completo la migracion `20260812_grupo2_rls.sql`, que activa RLS
-- en NUEVE tablas y NO crea ninguna politica.
--
-- ── Estado capturado del catalogo ANTES de la migracion ─────────────────────
--
-- Leido de `pg_class` y `pg_policies`, no transcrito de documentacion:
--
--   clinical_documents        relrowsecurity=false  relforcerowsecurity=false  politicas=2  owner=postgres
--   clinical_recommendations  relrowsecurity=false  relforcerowsecurity=false  politicas=2  owner=postgres
--   clinical_tasks            relrowsecurity=false  relforcerowsecurity=false  politicas=3  owner=postgres
--   crm_notes                 relrowsecurity=false  relforcerowsecurity=false  politicas=1  owner=postgres
--   family_genograms          relrowsecurity=false  relforcerowsecurity=false  politicas=0  owner=postgres
--   patient_anamnesis         relrowsecurity=false  relforcerowsecurity=false  politicas=3  owner=postgres
--   patient_prescriptions     relrowsecurity=false  relforcerowsecurity=false  politicas=4  owner=postgres
--   telemetry_events          relrowsecurity=false  relforcerowsecurity=false  politicas=2  owner=postgres
--   user_guide_progress       relrowsecurity=false  relforcerowsecurity=false  politicas=1  owner=postgres
--
-- Las 18 politicas de estas nueve tablas ya existian antes del Grupo 2 y la
-- migracion NO las toca: no hace falta recrearlas al revertir. Para volver a
-- verlas tal cual estaban esta el backup del Grupo 0,
-- `20260812_pre_grupo0_politicas.sql`, que contiene las 48 originales.
--
-- `family_genograms` entra deliberadamente SIN politicas: 0 filas y 0
-- consumidores. Encender RLS la cierra por defecto, que es lo correcto para
-- una tabla clinica que todavia no se usa. Revertir la reabre a
-- `authenticated`, que hoy tiene `raw` sobre ella.
--
-- ── Huellas del esquema en el momento del backup ────────────────────────────
--
--   ACL de las 37 tablas .. 64cdb69b1241ea34ac996556da08dc19
--   42 triggers ........... 217dffa660659d3cf920f78d1ca5f344
--   62 foreign keys ....... b9087924187f648a75b1677f7e8cd3ea
--   274 funciones ......... a093e1446067405c4d51432b46e6f543
--   51 politicas .......... faa7706dd5cad935072f5113cfca8300
--   RLS ................... 2 de 37 (mood_entries, service_requests)
--   FORCE RLS ............. 0 de 37
--
-- Filas: patient_anamnesis 4 · las otras ocho, 0.
--
-- ── Que NO hace este archivo ────────────────────────────────────────────────
--
-- No toca politicas, ACL, triggers, FK, funciones, RPC, columnas, indices ni
-- datos. No toca las otras 28 tablas ni las dos del Grupo 1: `mood_entries` y
-- `service_requests` conservan su RLS. Revertir devuelve exactamente a
-- RLS 2 de 37.
--
-- ── Idempotencia ────────────────────────────────────────────────────────────
--
-- `DISABLE ROW LEVEL SECURITY` sobre una tabla con RLS ya apagado no es un
-- error. Ejecutable las veces que haga falta.
-- ============================================================================

-- ─── Reversion ──────────────────────────────────────────────────────────────

ALTER TABLE public.patient_anamnesis        DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_prescriptions    DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_documents       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_recommendations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_tasks           DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_notes                DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_guide_progress      DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.telemetry_events         DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_genograms         DISABLE ROW LEVEL SECURITY;

-- ─── Comprobacion posterior a la reversion ──────────────────────────────────
--
-- SELECT count(*) FROM pg_class
--  WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' AND relrowsecurity;
--   -> 2  (solo mood_entries y service_requests, del Grupo 1)
--
-- SELECT count(*) FROM pg_policies WHERE schemaname = 'public';
--   -> 51  (las politicas nunca se tocaron)
