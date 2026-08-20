-- ============================================================================
-- Sprint Clinical Notes RLS
--
-- Activa RLS sobre public.clinical_notes con cuatro políticas.
--
-- QUÉ CIERRA — dos problemas distintos, medidos en el diagnóstico:
--
--   1. LECTURA. Hoy cualquier usuario con sesión lee las 24 notas de los 4
--      pacientes, con soap_data y treatment_plan completos: la historia
--      clínica entera. Medido: paciente propietario 24, paciente ajeno 24,
--      terapeuta sin relación 24. Es el dato más sensible de la plataforma.
--
--   2. INTEGRIDAD. clinical_notes NO tiene trigger de autoría (clinical_consents
--      sí lo tiene). Hoy un paciente puede insertar una nota con is_signed=true
--      y therapist_id apuntando a su terapeuta: un documento clínico
--      falsificado y firmado a nombre de un profesional que no lo escribió.
--      Medido: "NADA. Se crea." Ningún trigger lo impide; la política de
--      INSERT es lo que lo cierra.
--
-- DECISIÓN DE PRODUCTO APLICADA:
-- el paciente NO lee clinical_notes. Ningún consumidor se las muestra —los 7
-- son de terapeuta/admin— y el acceso actual es una capacidad no diseñada a un
-- jsonb clínico crudo. Por eso NO hay política de SELECT para pacientes.
--
-- QUÉ NO TOCA:
-- ACL, triggers, funciones, RPC, FK, índices, vistas, datos, frontend ni
-- ninguna otra tabla. En particular NO toca clinical_consents, que tiene su
-- propio sprint.
--
-- Los dos triggers siguen haciendo su trabajo:
--   check_clinical_note_immutability frena la edición de una nota firmada
--     A TODO EL MUNDO, incluido el terapeuta autor. Es inmutabilidad clínica,
--     no control de acceso, y RLS no lo sustituye.
--   audit_clinical_note_changes (esquema audit, DEFINER de postgres) sigue
--     escribiendo en audit.clinical_logs; RLS sobre public.clinical_notes no
--     le afecta.
--
-- is_therapist_of() se usa tal cual y NO se modifica: es SECURITY DEFINER de
-- postgres, así que la política no falla con 42501 al consultar
-- patient_therapist —la lección del Grupo 0—, y no filtra por status, de modo
-- que el terapeuta conserva el acceso a la historia después del alta.
--
-- Backup de reversión: supabase/backups/20260813_pre_clinical_notes_rls.sql
-- Diagnóstico: contexto-proyecto/auditorias-tecnicas/Diagnostico_RLS_clinical_notes_consents_2026-08-13.md
--
-- Idempotente: cada política se elimina antes de crearse; ENABLE es idempotente.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Lectura del terapeuta, acotada a sus pacientes.
--    Consumidores: clinicalService.ts:30 getLatestNote,
--                  clinicalService.ts:42 getSignedNotesHistory,
--                  patientOverviewService.ts:70 getPatientDocuments.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Therapists read notes of assigned patients" ON public.clinical_notes;
CREATE POLICY "Therapists read notes of assigned patients"
  ON public.clinical_notes
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (public.is_therapist_of(patient_id));

-- ----------------------------------------------------------------------------
-- 2. Lectura del administrador, sin acotar.
--    Consumidor: pacientes.$patientId.tsx, que se guarda a therapist|admin
--    en el frontend (línea 134). Sin esta política la ficha se vería VACÍA
--    y sin error, que es el modo de fallo de RLS en lectura.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins read all clinical notes" ON public.clinical_notes;
CREATE POLICY "Admins read all clinical notes"
  ON public.clinical_notes
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (public.get_my_role() = 'admin');

-- ----------------------------------------------------------------------------
-- 3. Alta: solo un terapeuta, solo sobre un paciente suyo, y solo a nombre
--    propio. Es la política que cierra la falsificación de notas firmadas.
--    Consumidores: clinicalService.ts:68 y patientOverviewService.ts:185
--    (ninguno de los dos usa .select(), así que no interviene el RETURNING).
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Therapists create notes for assigned patients" ON public.clinical_notes;
CREATE POLICY "Therapists create notes for assigned patients"
  ON public.clinical_notes
  AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = therapist_id AND public.is_therapist_of(patient_id));

-- ----------------------------------------------------------------------------
-- 4. Edición: solo el terapeuta autor de la nota.
--    Consumidores: clinicalService.ts:67 y patientOverviewService.ts:184.
--    Sin esta política el UPDATE devolvería 0 filas EN SILENCIO.
--    El trigger de inmutabilidad sigue por encima: sobre una nota firmada
--    esto seguirá dando INMUTABILIDAD_CLINICA, también al autor.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authoring therapists update their own notes" ON public.clinical_notes;
CREATE POLICY "Authoring therapists update their own notes"
  ON public.clinical_notes
  AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING (auth.uid() = therapist_id)
  WITH CHECK (auth.uid() = therapist_id);

-- ----------------------------------------------------------------------------
-- Sin política de DELETE, deliberadamente: authenticated no tiene 'd' en la
-- ACL y el flujo clínico no borra notas. Sin política, el DELETE queda
-- cerrado. Conviene no confundirlo: hoy lo corta la ACL, no RLS.
--
-- Sin política de SELECT para pacientes: es la decisión de producto aprobada.
-- ----------------------------------------------------------------------------

ALTER TABLE public.clinical_notes ENABLE ROW LEVEL SECURITY;

COMMIT;

-- ============================================================================
-- REGLA 1 — el catálogo demuestra el estado final
-- ============================================================================
SELECT
  (SELECT relrowsecurity FROM pg_class
     WHERE oid = 'public.clinical_notes'::regclass)                      AS rls_activo,
  (SELECT relforcerowsecurity FROM pg_class
     WHERE oid = 'public.clinical_notes'::regclass)                      AS force_activo,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'clinical_notes')       AS politicas,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'clinical_notes'
       AND cmd = 'SELECT')                                               AS de_select,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'clinical_notes'
       AND cmd = 'INSERT')                                               AS de_insert,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'clinical_notes'
       AND cmd = 'UPDATE')                                               AS de_update,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'clinical_notes'
       AND cmd = 'DELETE')                                               AS de_delete,
  (SELECT count(*) FROM public.clinical_notes)                           AS filas,
  (SELECT count(*) FROM pg_trigger
     WHERE tgrelid = 'public.clinical_notes'::regclass
       AND NOT tgisinternal)                                             AS triggers,
  (SELECT relrowsecurity FROM pg_class
     WHERE oid = 'public.clinical_consents'::regclass)                   AS consents_intacta,
  (SELECT count(*) FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity) AS tablas_con_rls;
