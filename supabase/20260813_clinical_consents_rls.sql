-- ============================================================================
-- Sprint clinical_consents RLS
--
-- Activa RLS sobre public.clinical_consents con cinco políticas.
--
-- QUÉ CIERRA — solo lectura, y conviene decirlo con precisión:
--
--   Medido antes de migrar, con lecturas limpias:
--     paciente propietario, todos ....... 2 de 2   ve el ajeno
--     paciente ajeno, el de otro ........ 1        FUGA
--     tercero sin relación, todos ....... 2 de 2   FUGA
--     terapeuta ajeno ................... 1        FUGA
--     anon .............................. 42501 permission denied (ACL)
--
--   La fuga es de metadatos de salud: revela QUÉ PERSONAS están en proceso
--   clínico y desde cuándo. El registro no contiene contenido clínico, pero
--   el hecho de estar en tratamiento sí es información de salud.
--
-- QUÉ NO CIERRA, porque YA ESTABA CERRADO — no atribuirle mérito a RLS:
--
--   Las escrituras ilegítimas las corta hoy el trigger
--   enforce_clinical_consent_authorship, medido SIN RLS:
--     paciente ajeno revoca el de otro .. P0001 CLINICAL_CONSENT_AUTHOR_MISMATCH
--     paciente ajeno consiente por otro . P0001 CLINICAL_CONSENT_AUTHOR_MISMATCH
--     terapeuta asignado revoca ......... P0001 CLINICAL_CONSENT_AUTHOR_MISMATCH
--     admin revoca ...................... 1 fila (soporte, permitido a propósito)
--   Y el DELETE lo corta la ACL: authenticated no tiene 'd'. El trigger
--   enforce_clinical_consent_no_delete NI SIQUIERA LLEGA A EJECUTARSE para
--   authenticated; es la red para service_role y postgres.
--
--   Las políticas 4 y 5 son, por tanto, DEFENSA EN PROFUNDIDAD deliberada:
--   duplican la regla del trigger para que la barrera no desaparezca si algún
--   día el trigger se modifica o se retira. No son redundancia por descuido.
--
-- POR QUÉ EL TERAPEUTA NECESITA LEER (política 2):
--   pacientes.$patientId.tsx:109 llama getClinicalConsentStateById(patientId)
--   para comprobar de un vistazo que el consentimiento existe y sigue vigente.
--   Es una lectura cruzada legítima. Sin ella, la ficha mostraría "pendiente"
--   a un paciente que sí consintió — un fallo silencioso y clínicamente grave.
--
-- QUÉ NO TOCA:
-- ACL, triggers, funciones, RPC, FK, índices, vistas, datos, frontend,
-- clinical_notes ni ninguna otra tabla.
--
-- Backup: supabase/backups/20260813_pre_clinical_consents_rls.sql
-- Diagnóstico: contexto-proyecto/auditorias-tecnicas/Diagnostico_RLS_clinical_notes_consents_2026-08-13.md
--
-- Idempotente: cada política se elimina antes de crearse; ENABLE es idempotente.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. El titular lee su propio consentimiento.
--    Consumidores: getCurrentConsent:59 y, sobre él, getClinicalConsentState
--    (gate de useAuth.tsx:124 y ClinicalConsentCard).
--    También es la política de la que dependen acceptClinicalConsent y
--    revokeClinicalConsent, que leen ANTES de escribir para decidir si
--    insertan o actualizan.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Patients read their own consent" ON public.clinical_consents;
CREATE POLICY "Patients read their own consent"
  ON public.clinical_consents
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (auth.uid() = patient_id);

-- ----------------------------------------------------------------------------
-- 2. El terapeuta lee el consentimiento de sus pacientes.
--    Consumidor: pacientes.$patientId.tsx:109 getClinicalConsentStateById.
--    is_therapist_of() es SECURITY DEFINER y no filtra por status, igual que
--    en clinical_notes: se usa tal cual y NO se modifica.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Therapists read consent of assigned patients" ON public.clinical_consents;
CREATE POLICY "Therapists read consent of assigned patients"
  ON public.clinical_consents
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (public.is_therapist_of(patient_id));

-- ----------------------------------------------------------------------------
-- 3. El administrador lee todo. Misma ficha de paciente, guardada a
--    therapist|admin en el frontend.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins read all consents" ON public.clinical_consents;
CREATE POLICY "Admins read all consents"
  ON public.clinical_consents
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (public.get_my_role() = 'admin');

-- ----------------------------------------------------------------------------
-- 4. Alta: solo el titular, a nombre propio.
--    Consumidor: acceptClinicalConsent:123.
--    Consentir es un acto personal e indelegable — la misma regla que ya
--    expresa el trigger. Ni siquiera el admin puede otorgarlo por otro.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Patients record their own consent" ON public.clinical_consents;
CREATE POLICY "Patients record their own consent"
  ON public.clinical_consents
  AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = patient_id);

-- ----------------------------------------------------------------------------
-- 5. Modificación: el titular (aceptar de nuevo, revocar) o el admin (soporte).
--    Consumidores: acceptClinicalConsent:115 (reactivar) y
--    revokeClinicalConsent:138.
--    Mismo criterio en USING y en WITH CHECK.
--    Qué campos pueden cambiar lo sigue decidiendo
--    enforce_clinical_consent_immutability; esta política decide sobre qué
--    FILA se puede escribir, no QUÉ escritura es válida.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Patients and admins update consent" ON public.clinical_consents;
CREATE POLICY "Patients and admins update consent"
  ON public.clinical_consents
  AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING (auth.uid() = patient_id OR public.get_my_role() = 'admin')
  WITH CHECK (auth.uid() = patient_id OR public.get_my_role() = 'admin');

-- ----------------------------------------------------------------------------
-- Sin política de DELETE: un consentimiento no se borra, se revoca. Hoy lo
-- corta la ACL (authenticated no tiene 'd'), no RLS. No crear la política es
-- coherencia con el modelo, no la barrera real.
--
-- Sin política para anon: no tiene ningún privilegio sobre la tabla.
-- Sin política para service_role: tiene bypassrls.
-- ----------------------------------------------------------------------------

ALTER TABLE public.clinical_consents ENABLE ROW LEVEL SECURITY;

COMMIT;

-- ============================================================================
-- REGLA 1 — el catálogo demuestra el estado final
-- ============================================================================
SELECT
  (SELECT relrowsecurity FROM pg_class
     WHERE oid = 'public.clinical_consents'::regclass)                   AS rls_activo,
  (SELECT relforcerowsecurity FROM pg_class
     WHERE oid = 'public.clinical_consents'::regclass)                   AS force_activo,
  (SELECT coalesce(array_to_string(reloptions, ','), '(NULL)') FROM pg_class
     WHERE oid = 'public.clinical_consents'::regclass)                   AS reloptions,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'clinical_consents')    AS politicas,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'clinical_consents'
       AND cmd = 'SELECT')                                               AS de_select,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'clinical_consents'
       AND cmd = 'INSERT')                                               AS de_insert,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'clinical_consents'
       AND cmd = 'UPDATE')                                               AS de_update,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'clinical_consents'
       AND cmd = 'DELETE')                                               AS de_delete,
  (SELECT count(*) FROM public.clinical_consents)                        AS filas,
  (SELECT count(*) FROM pg_trigger
     WHERE tgrelid = 'public.clinical_consents'::regclass
       AND NOT tgisinternal)                                             AS triggers,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'clinical_notes')       AS notes_politicas,
  (SELECT count(*) FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity) AS tablas_con_rls,
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'public')         AS politicas_public;
