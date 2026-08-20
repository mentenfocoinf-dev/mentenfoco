-- ============================================================================
-- Sprint psychometric_evaluations RLS
--
-- Activa RLS sobre public.psychometric_evaluations, corrige una política que
-- estaba escrita desde el Grupo 0 pero rota contra los datos reales, y añade
-- la del administrador.
--
-- QUÉ CIERRA — fuga clínica medida, sin RLS:
--
--   tercero sin ninguna relación, todas ..... 40   con raw_answers y severidad
--   paciente ajeno, las de otro paciente .... 10
--   anon .................................... 42501 permission denied (ACL)
--
--   Son evaluaciones PHQ-9 y GAD-7 con total_score, severity_level y
--   raw_answers. El PHQ-9 incluye el ítem 9, de ideación suicida. Es el dato
--   más sensible que quedaba sin RLS junto con messages.
--
-- POR QUÉ HAY QUE CORREGIR UNA POLÍTICA EXISTENTE Y NO SOLO ENCENDER RLS:
--
--   La tabla ya tenía 4 políticas del Grupo 0, pero la de lectura del
--   terapeuta dice auth.uid() = therapist_id, y therapist_id es NULL en las
--   40 filas. Medido activando RLS en una transacción revertida:
--
--     terapeuta asignado ....  0 filas   <<< REGRESIÓN: perdía las 10 de su paciente
--     admin .................  0 filas   <<< no existía política de admin
--     paciente, las suyas ... 10 filas   esa política sí funcionaba
--
--   Encender RLS sin tocar nada habría dejado la ficha del paciente sin
--   historial psicométrico, en silencio. Por eso la corrección entra en la
--   misma migración: separar los dos pasos crearía una ventana con regresión
--   clínica.
--
-- QUÉ NO TOCA:
-- ACL, triggers, funciones, RPC, FK, índices, vistas, datos, frontend ni
-- ninguna otra tabla. En particular NO toca messages, therapist_profiles,
-- notifications ni clinical_guides.
--
-- El trigger free_plan_evaluation_limit sigue siendo la autoridad sobre el
-- límite de 30 días del plan gratuito. Es una regla de NEGOCIO, no de acceso:
-- RLS no la sustituye ni la duplica.
--
-- Backup: supabase/backups/20260813_pre_psychometric_evaluations_rls.sql
-- Diagnóstico: contexto-proyecto/auditorias-tecnicas/Diagnostico_RLS_15_restantes_2026-08-13.md
--
-- Idempotente: cada política se elimina antes de crearse; ENABLE es idempotente.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. SE CONSERVA TAL CUAL — lectura del paciente titular.
--    No se toca: medido, funciona (el paciente lee sus 10).
--    Es además la política de la que dependen los INSERT ... RETURNING de
--    CssrsModal.tsx:126 y PsychometricScaleModal.tsx:45, que necesitan el id
--    devuelto para escribir clinical_alerts.test_score_id.
--
--      "Patients can view their own evaluations"
--        FOR SELECT TO authenticated USING (auth.uid() = patient_id)
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 2. SE CORRIGE — lectura del terapeuta.
--
--    Antes: USING (auth.uid() = therapist_id)   -> 0 filas, therapist_id es NULL
--    Ahora: USING (is_therapist_of(patient_id)) -> la relación, no la autoría
--
--    Es la misma corrección que ya se aplicó en clinical_notes. is_therapist_of()
--    es SECURITY DEFINER de postgres, así que la política no falla con 42501 al
--    consultar patient_therapist —la lección del Grupo 0—, y no filtra por
--    status, de modo que el terapeuta conserva el acceso tras el alta.
--    NO se modifica la función.
--
--    Consumidor: clinicalService.ts:120 getPatientEvaluations.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Therapists can view evaluations of assigned patients"
  ON public.psychometric_evaluations;
CREATE POLICY "Therapists can view evaluations of assigned patients"
  ON public.psychometric_evaluations
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (public.is_therapist_of(patient_id));

-- ----------------------------------------------------------------------------
-- 3. SE AÑADE — lectura del administrador.
--    pacientes.$patientId.tsx se guarda a therapist|admin y llama a
--    getPatientEvaluations:120. Sin esta política el admin vería el historial
--    psicométrico VACÍO y sin error: el modo de fallo de RLS en lectura.
--    Es paridad con el comportamiento actual, no una decisión nueva.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins read all evaluations" ON public.psychometric_evaluations;
CREATE POLICY "Admins read all evaluations"
  ON public.psychometric_evaluations
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (public.get_my_role() = 'admin');

-- ----------------------------------------------------------------------------
-- 4 y 5. SE CONSERVAN TAL CUAL — las dos de alta.
--
--      "Patients can insert their own evaluations"
--        FOR INSERT TO authenticated WITH CHECK (auth.uid() = patient_id)
--          -> CssrsModal.tsx:126 y PsychometricScaleModal.tsx:45
--
--      "Therapists can insert evaluations for assigned patients"
--        FOR INSERT TO authenticated
--        WITH CHECK (auth.uid() = therapist_id AND is_therapist_of(patient_id))
--          -> CognitiveScreeningForm.tsx:52
--
--    Ojo: la de terapeuta sí puede usar auth.uid() = therapist_id, porque en el
--    alta el terapeuta SÍ se pone a sí mismo. El problema del therapist_id NULL
--    afecta a la LECTURA de las filas históricas, no al alta.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- Sin política de UPDATE, deliberadamente: no hay ningún consumidor que
-- actualice, y dejarla fuera cierra la escritura que hoy permite la ACL ('w')
-- sin que ningún trigger la vigile.
--
-- Sin política de DELETE: ya lo corta la ACL (authenticated no tiene 'd').
-- Conviene no apuntárselo a RLS.
-- ----------------------------------------------------------------------------

ALTER TABLE public.psychometric_evaluations ENABLE ROW LEVEL SECURITY;

COMMIT;

-- ============================================================================
-- REGLA 1 — el catálogo demuestra el estado final
-- ============================================================================
SELECT
  (SELECT relrowsecurity FROM pg_class
     WHERE oid = 'public.psychometric_evaluations'::regclass)                AS rls_activo,
  (SELECT relforcerowsecurity FROM pg_class
     WHERE oid = 'public.psychometric_evaluations'::regclass)                AS force_activo,
  (SELECT coalesce(array_to_string(reloptions, ','), '(NULL)') FROM pg_class
     WHERE oid = 'public.psychometric_evaluations'::regclass)                AS reloptions,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'psychometric_evaluations') AS politicas,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'psychometric_evaluations'
       AND cmd = 'SELECT')                                                   AS de_select,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'psychometric_evaluations'
       AND cmd = 'INSERT')                                                   AS de_insert,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'psychometric_evaluations'
       AND cmd IN ('UPDATE', 'DELETE'))                                      AS de_update_delete,
  (SELECT qual FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'psychometric_evaluations'
       AND policyname = 'Therapists can view evaluations of assigned patients') AS terapeuta_corregida,
  (SELECT count(*) FROM public.psychometric_evaluations)                     AS filas,
  (SELECT count(*) FROM pg_trigger
     WHERE tgrelid = 'public.psychometric_evaluations'::regclass
       AND NOT tgisinternal)                                                 AS triggers,
  (SELECT relrowsecurity FROM pg_class
     WHERE oid = 'public.messages'::regclass)                                AS messages_intacta,
  (SELECT count(*) FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity)     AS tablas_con_rls,
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'public')             AS politicas_public;
