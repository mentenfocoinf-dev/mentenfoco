-- ============================================================================
-- GRUPO 2 — Segunda tanda de activacion de RLS.
--
-- NUEVE `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`. Nada mas.
--
-- No crea ni modifica NINGUNA politica: el Grupo 0 ya dejo correctas las 18
-- que gobiernan estas tablas. No toca ACL, `DEFAULT PRIVILEGES`, triggers, FK,
-- funciones, RPC, columnas, indices, datos ni React. Sin `FORCE RLS`.
--
-- RLS pasa de 2 a 11 de 37 tablas. FORCE sigue en 0.
--
-- Reversion: `supabase/backups/20260812_pre_grupo2_rls.sql`
--
-- ── Por que estas nueve ─────────────────────────────────────────────────────
--
-- Ninguna funcion de `public` las menciona. Eso importa porque el sprint 4Q
-- midio que RLS no alcanza a las 31 RPC `SECURITY DEFINER` —su owner
-- `postgres` tiene `bypassrls`—: donde no hay funcion, RLS es la unica puerta
-- y funciona entera.
--
-- Ocho de las nueve no tienen ningun consumidor vivo. La novena,
-- `patient_anamnesis`, tiene dos consumidores reales y cobertura de politicas
-- completa, ademas de datos de cuatro pacientes con los que demostrar el
-- aislamiento de verdad y no por ausencia de filas.
--
-- ── Que gobierna cada tabla, ya existente ───────────────────────────────────
--
--   patient_anamnesis         ALL paciente propio · SELECT admin · SELECT terapeuta asignado
--   patient_prescriptions     INSERT terapeuta · SELECT paciente y terapeuta · UPDATE paciente
--   clinical_documents        ALL terapeuta propietario · SELECT paciente
--   clinical_recommendations  ALL terapeuta propietario · SELECT paciente
--   clinical_tasks            ALL terapeuta · SELECT paciente · UPDATE paciente
--   crm_notes                 ALL admin
--   user_guide_progress       ALL usuario propietario
--   telemetry_events          INSERT propio · SELECT admin
--   family_genograms          NINGUNA, a proposito (ver abajo)
--
-- Las seis politicas `FOR ALL` de esta lista llevan solo `USING`, sin
-- `WITH CHECK`. Se comprobo ejecutando —con una tabla de usar y tirar creada y
-- destruida dentro de una transaccion revertida— que en ese caso PostgreSQL
-- aplica el `USING` tambien como `WITH CHECK`: el intento de insertar con un
-- id ajeno, o de cambiar el dueno de una fila propia, devuelve
-- `42501 new row violates row-level security policy`. No hay hueco.
--
-- ── family_genograms entra sin politicas, y es intencionado ─────────────────
--
-- Cero filas, cero consumidores en `src/`, Edge Functions, scripts y cron, y
-- cero funciones que la mencionen. Hoy `authenticated` tiene `raw` sobre una
-- tabla clinica que todavia no existe como funcionalidad. Activar RLS sin
-- politicas la cierra por defecto. El dia que se construya el genograma
-- familiar, sus politicas se escriben junto con su codigo.
--
-- ── Que queda FUERA, y por que ──────────────────────────────────────────────
--
-- `clinical_alerts`: la ACL permite `UPDATE` pero sus 5 politicas cubren solo
-- `INSERT` y `SELECT`, y `resolveCrisisAlert()` hace un `UPDATE`. Con RLS
-- activo devolveria 0 filas afectadas SIN error, y el codigo solo comprueba
-- `if (error) throw`: la resolucion de alertas de crisis fallaria en silencio.
-- Necesita su propia politica de UPDATE antes de entrar en ningun grupo.
--
-- `clinical_notes` (24 filas, 8 consumidores) y `clinical_consents` (2 filas,
-- 4 consumidores) no tienen ninguna politica: encender RLS las cerraria
-- enteras. `test_scores`, `content_revisions` y `guides`, lo mismo sin
-- consumidores. `psychometric_evaluations` la toca una funcion.
-- `crm_leads` tiene flujo publico y una politica `TO public` que merece
-- analisis aparte.
--
-- ── Idempotencia ────────────────────────────────────────────────────────────
--
-- `ENABLE ROW LEVEL SECURITY` sobre una tabla que ya lo tiene activo no es un
-- error ni cambia nada. Ejecutable las veces que haga falta.
-- ============================================================================

ALTER TABLE public.patient_anamnesis        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_prescriptions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_documents       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_tasks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_notes                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_guide_progress      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telemetry_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_genograms         ENABLE ROW LEVEL SECURITY;
