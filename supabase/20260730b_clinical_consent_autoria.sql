-- ============================================================================
-- Un consentimiento solo lo otorga su titular.
--
-- Detectado al probar la API real: con RLS apagado, la anon key podia INSERTAR
-- una fila a nombre de cualquier paciente. En otras tablas eso se difiere a la
-- fase de seguridad, pero aqui no puede esperar: `clinical_consents` ES la
-- evidencia etico-legal de que hubo consentimiento (Ley 1090). Un registro que
-- cualquiera puede fabricar no prueba nada, y peor: haria creer al terapeuta que
-- tiene respaldo para continuar el proceso cuando no lo tiene.
--
-- Se resuelve como el resto de reglas del proyecto: en el TRIGGER, que si actua
-- con RLS apagado. Igual que en blog_comments, se distingue el service_role
-- (seeds y migraciones) de un visitante con la anon key.
-- ============================================================================

CREATE OR REPLACE FUNCTION enforce_clinical_consent_authorship()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor    uuid := auth.uid();
  v_jwt_role text := coalesce(
                       nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
                       ''
                     );
  v_role     text;
BEGIN
  IF v_actor IS NULL THEN
    IF v_jwt_role = 'service_role' OR v_jwt_role = '' THEN
      RETURN NEW;  -- migracion / seed
    END IF;
    RAISE EXCEPTION 'CLINICAL_CONSENT_ANONYMOUS_FORBIDDEN: hay que iniciar sesion para consentir.';
  END IF;

  SELECT role::text INTO v_role FROM profiles WHERE id = v_actor;

  -- El admin puede corregir un registro (soporte), pero NO otorgarlo por otro:
  -- consentir es un acto personal e indelegable.
  IF NEW.patient_id <> v_actor THEN
    IF TG_OP = 'INSERT' THEN
      RAISE EXCEPTION 'CLINICAL_CONSENT_AUTHOR_MISMATCH: nadie puede consentir en nombre de otra persona.';
    END IF;
    IF v_role <> 'admin' THEN
      RAISE EXCEPTION 'CLINICAL_CONSENT_AUTHOR_MISMATCH: solo el titular puede cambiar su consentimiento.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clinical_consent_authorship ON clinical_consents;
CREATE TRIGGER trg_clinical_consent_authorship
  BEFORE INSERT OR UPDATE ON clinical_consents
  FOR EACH ROW EXECUTE FUNCTION enforce_clinical_consent_authorship();
