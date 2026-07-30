-- ============================================================================
-- Consentimiento informado CLINICO (Ley 1090/2006).
--
-- No reemplaza al consentimiento de datos (Ley 1581), que ya vive en
-- profiles.terms_accepted_at / terms_version. Son dos cosas distintas y ambas
-- son obligatorias:
--   - Ley 1581  -> autoriza tratar nombre, correo y telefono de la cuenta.
--   - Ley 1090  -> consiente el PROCESO de atencion psicologica: modalidad,
--                  limites de la confidencialidad, historia clinica, riesgos.
-- El primero se otorga al registrarse; el segundo, antes de entregar la
-- anamnesis. Meterlos en la misma columna haria imposible demostrar cual de los
-- dos aceptó el paciente y cuando.
--
-- Va en tabla propia y no en columnas de profiles porque es un registro
-- HISTORICO: cada version aceptada deja su fila, y una revocacion no borra la
-- aceptacion previa. Es la evidencia etico-legal del proceso.
-- ============================================================================

CREATE TABLE IF NOT EXISTS clinical_consents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- Coincide con CLINICAL_CONSENT_VERSION del front. Si el texto cambia, sube
  -- la version y se vuelve a pedir: nadie queda consintiendo un texto que ya no
  -- es el vigente.
  version     integer NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT clinical_consents_version_positiva_check CHECK (version >= 1),
  -- No se puede revocar antes de aceptar.
  CONSTRAINT clinical_consents_revocacion_posterior_check
    CHECK (revoked_at IS NULL OR revoked_at >= accepted_at)
);

CREATE INDEX IF NOT EXISTS clinical_consents_patient_idx
  ON clinical_consents (patient_id);

-- Una sola aceptacion vigente por paciente y version: si vuelve a aceptar tras
-- revocar, se levanta el revoked_at de la fila existente en vez de acumular
-- duplicados que harian ambiguo cual es el consentimiento actual.
CREATE UNIQUE INDEX IF NOT EXISTS clinical_consents_patient_version_key
  ON clinical_consents (patient_id, version);

-- ── El registro es historico: no se reescribe ────────────────────────────────
--
-- Trigger y no solo policy, por el motivo de siempre en este proyecto: con RLS
-- apagado en pruebas una policy no filtra nada, y esto es evidencia legal.
--
-- Lo unico que puede cambiar de una fila existente es el estado de revocacion
-- (revocar, o volver a aceptar). Cambiar `version`, `patient_id` o mover
-- `accepted_at` seria falsificar la evidencia de qué texto se aceptó y cuándo.
CREATE OR REPLACE FUNCTION enforce_clinical_consent_immutability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.patient_id IS DISTINCT FROM OLD.patient_id
     OR NEW.version IS DISTINCT FROM OLD.version
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'CLINICAL_CONSENT_IMMUTABLE: de un consentimiento registrado solo puede cambiar el estado de revocacion.';
  END IF;

  -- accepted_at solo se mueve al re-aceptar (cuando se limpia revoked_at).
  IF NEW.accepted_at IS DISTINCT FROM OLD.accepted_at
     AND NOT (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS NULL) THEN
    RAISE EXCEPTION 'CLINICAL_CONSENT_IMMUTABLE: la fecha de aceptacion no se edita.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clinical_consent_immutability ON clinical_consents;
CREATE TRIGGER trg_clinical_consent_immutability
  BEFORE UPDATE ON clinical_consents
  FOR EACH ROW EXECUTE FUNCTION enforce_clinical_consent_immutability();

-- Un DELETE borraria la evidencia de que hubo consentimiento. Revocar es un
-- UPDATE de revoked_at, no un borrado.
CREATE OR REPLACE FUNCTION enforce_clinical_consent_no_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'CLINICAL_CONSENT_NO_DELETE: un consentimiento no se borra; se revoca (revoked_at).';
END;
$$;

DROP TRIGGER IF EXISTS trg_clinical_consent_no_delete ON clinical_consents;
CREATE TRIGGER trg_clinical_consent_no_delete
  BEFORE DELETE ON clinical_consents
  FOR EACH ROW EXECUTE FUNCTION enforce_clinical_consent_no_delete();

-- ============================================================================
-- FASE DE SEGURIDAD (no aplicar todavia: RLS esta desactivado a proposito en
-- todo el proyecto; ver 00 Indice maestro / Decisiones tecnicas).
--
-- Mientras RLS siga apagado, la barrera REAL son los triggers de arriba, que si
-- estan activos. El filtrado de LECTURA lo hace hoy clinicalConsentService.ts.
--
-- ALTER TABLE clinical_consents ENABLE ROW LEVEL SECURITY;
--
-- -- El paciente lee lo suyo.
-- CREATE POLICY clinical_consents_select_propio ON clinical_consents
--   FOR SELECT USING (patient_id = auth.uid());
--
-- -- El terapeuta asignado y el admin lo leen: necesitan comprobar que el
-- -- consentimiento existe y esta vigente antes de continuar el proceso.
-- CREATE POLICY clinical_consents_select_equipo ON clinical_consents
--   FOR SELECT USING (
--     EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
--     OR EXISTS (
--       SELECT 1 FROM patient_therapist pt
--        WHERE pt.patient_id = clinical_consents.patient_id
--          AND pt.therapist_id = auth.uid()
--     )
--   );
--
-- -- Solo el propio paciente consiente, y siempre a su nombre.
-- CREATE POLICY clinical_consents_insert_propio ON clinical_consents
--   FOR INSERT WITH CHECK (patient_id = auth.uid());
--
-- -- Revocar (o volver a aceptar) es cosa del paciente. Qué columnas puede tocar
-- -- ya lo restringe el trigger de inmutabilidad.
-- CREATE POLICY clinical_consents_update_propio ON clinical_consents
--   FOR UPDATE USING (patient_id = auth.uid());
--
-- -- Sin policy de DELETE: nadie borra evidencia (ademas del trigger).
-- ============================================================================
