-- ============================================================================
-- Limite de evaluaciones para el plan gratuito: una cada 30 dias.
--
-- Se implementa como trigger y no como policy porque RLS sigue desactivado en
-- todo el proyecto (la fase de seguridad va al final). El trigger es ademas el
-- lugar correcto para una regla de negocio: aplica sin importar si la llamada
-- viene del cliente, de la app movil o de un script.
--
-- EXCLUSIONES DELIBERADAS:
--   * cssrs  -> escala de riesgo suicida. Restringir el acceso a una evaluacion
--               de seguridad detras de un limite comercial es un riesgo clinico
--               inaceptable: siempre disponible, para cualquier plan.
--   * moca / mmse -> los registra el terapeuta en consulta, no el paciente.
-- El limite aplica por tanto a phq9 y gad7, que son las que el panel del
-- paciente ofrece como "Evaluaciones de bienestar".
-- ============================================================================

CREATE OR REPLACE FUNCTION enforce_free_plan_evaluation_limit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_plan text;
  v_role text;
  v_last timestamptz;
BEGIN
  -- Solo las escalas autoadministradas de bienestar entran en el limite.
  IF NEW.scale_type NOT IN ('phq9', 'gad7') THEN
    RETURN NEW;
  END IF;

  SELECT plan_type::text, role::text
    INTO v_plan, v_role
    FROM profiles
   WHERE id = NEW.patient_id;

  -- Solo pacientes del plan gratuito. Terapeutas y admin tambien figuran con
  -- plan_type 'free' en la base, de ahi que se exija tambien el rol.
  IF v_role IS DISTINCT FROM 'patient' OR v_plan IS DISTINCT FROM 'free' THEN
    RETURN NEW;
  END IF;

  SELECT max(evaluated_at)
    INTO v_last
    FROM psychometric_evaluations
   WHERE patient_id = NEW.patient_id
     AND scale_type IN ('phq9', 'gad7');

  IF v_last IS NOT NULL AND v_last > now() - interval '30 days' THEN
    RAISE EXCEPTION 'FREE_PLAN_EVALUATION_LIMIT'
      USING DETAIL = to_char(v_last + interval '30 days', 'YYYY-MM-DD"T"HH24:MI:SSOF');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS free_plan_evaluation_limit ON psychometric_evaluations;
CREATE TRIGGER free_plan_evaluation_limit
  BEFORE INSERT ON psychometric_evaluations
  FOR EACH ROW
  EXECUTE FUNCTION enforce_free_plan_evaluation_limit();

COMMENT ON FUNCTION enforce_free_plan_evaluation_limit IS
  'Plan gratuito: una evaluacion de bienestar (phq9/gad7) cada 30 dias. cssrs queda siempre libre por seguridad clinica.';
