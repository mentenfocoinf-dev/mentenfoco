-- ============================================================================
-- Agenda unificada: una sola fuente de verdad para las horas ocupadas.
--
-- ── Lo que había, y por qué se decide así ───────────────────────────────────
--
-- `therapy_sessions`  20 filas, seis funciones de servicio y cuatro pantallas
--                     dependiendo de ella. Tiene lo operativo de una sesión:
--                     duración, enlace de vídeo, estado de recordatorio, notas.
--                     La crea el profesional.
-- `appointments`      0 filas, recién creada. Tiene lo que la otra no: la
--                     relación, quién la pidió y la negociación
--                     (solicitada → confirmada). La pide el paciente.
--
-- No son lo mismo y ninguna sobra: una es la NEGOCIACIÓN de un hueco, la otra
-- es la SESIÓN clínica. Por eso `therapy_sessions` sigue siendo la fuente de
-- verdad de la agenda —tiene los datos y los consumidores— y `appointments`
-- pasa a ser la puerta por la que un paciente pide hora. Confirmar una cita
-- MATERIALIZA su sesión.
--
-- Un solo enlace, y en la tabla que manda: `therapy_sessions.appointment_id`.
-- Poner también `session_id` en appointments habría sido el mismo dato dos
-- veces, con dos formas de que discrepen.
--
-- ── Solapamientos entre dos tablas ──────────────────────────────────────────
--
-- Una restricción EXCLUDE no puede abarcar dos tablas, así que la comprobación
-- va en trigger. Un trigger que solo consulta tiene condición de carrera: dos
-- transacciones simultáneas leen "libre" y las dos insertan. Se resuelve con
-- `pg_advisory_xact_lock` sobre el profesional: las transacciones que tocan la
-- agenda de la misma persona se serializan, y el lock se suelta solo al
-- terminar. Dentro del lock, la lectura ya es fiable.
-- ============================================================================

-- ── El enlace ───────────────────────────────────────────────────────────────
ALTER TABLE public.therapy_sessions
  ADD COLUMN IF NOT EXISTS appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL;

DO $$
BEGIN
  -- Una cita produce como mucho una sesión.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'therapy_sessions_appointment_key') THEN
    ALTER TABLE public.therapy_sessions
      ADD CONSTRAINT therapy_sessions_appointment_key UNIQUE (appointment_id);
  END IF;
END
$$;

COMMENT ON COLUMN public.therapy_sessions.appointment_id IS
  'Cita que originó esta sesión. NULL en las creadas directamente por el profesional, incluidas las 20 anteriores a la unificación.';

CREATE INDEX IF NOT EXISTS idx_therapy_sessions_agenda
  ON public.therapy_sessions (therapist_id, scheduled_at)
  WHERE status <> 'cancelada';

-- ── Comprobación de solapamiento, sobre las DOS tablas ──────────────────────
--
-- `p_ignorar_cita` y `p_ignorar_sesion` existen para que una cita y la sesión
-- que ella misma genera no se consideren mutuamente ocupadas.
CREATE OR REPLACE FUNCTION public.agenda_hay_conflicto(
  p_therapist_id uuid, p_patient_id uuid,
  p_inicio timestamptz, p_fin timestamptz,
  p_ignorar_cita uuid DEFAULT NULL, p_ignorar_sesion uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE hay boolean;
BEGIN
  -- Sesiones clínicas vivas.
  SELECT EXISTS (
    SELECT 1 FROM therapy_sessions s
    WHERE s.status <> 'cancelada'
      AND (p_ignorar_sesion IS NULL OR s.id <> p_ignorar_sesion)
      AND (p_ignorar_cita IS NULL OR s.appointment_id IS DISTINCT FROM p_ignorar_cita)
      AND (s.therapist_id = p_therapist_id OR s.patient_id = p_patient_id)
      AND tstzrange(s.scheduled_at, s.scheduled_at + make_interval(mins => s.duration_minutes))
          && tstzrange(p_inicio, p_fin)
  ) INTO hay;
  IF hay THEN RETURN true; END IF;

  -- Citas vivas: solicitadas o confirmadas.
  SELECT EXISTS (
    SELECT 1 FROM appointments a
    WHERE a.status IN ('requested', 'confirmed')
      AND (p_ignorar_cita IS NULL OR a.id <> p_ignorar_cita)
      AND (a.therapist_id = p_therapist_id OR a.patient_id = p_patient_id)
      AND tstzrange(a.starts_at, a.ends_at) && tstzrange(p_inicio, p_fin)
  ) INTO hay;
  RETURN hay;
END
$$;

/** Serializa a quien toque la agenda de este profesional o este paciente. */
CREATE OR REPLACE FUNCTION public.agenda_lock(p_therapist_id uuid, p_patient_id uuid)
RETURNS void LANGUAGE sql AS $$
  SELECT pg_advisory_xact_lock(hashtextextended(p_therapist_id::text, 0)),
         pg_advisory_xact_lock(hashtextextended(p_patient_id::text, 0));
  SELECT NULL::void;
$$;

-- ── Citas: comprobar contra las dos tablas ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_appointment_agenda()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status NOT IN ('requested', 'confirmed') THEN
    RETURN NEW; -- cancelar o cerrar nunca puede chocar con nada
  END IF;

  PERFORM agenda_lock(NEW.therapist_id, NEW.patient_id);

  IF agenda_hay_conflicto(NEW.therapist_id, NEW.patient_id, NEW.starts_at, NEW.ends_at, NEW.id) THEN
    RAISE EXCEPTION 'AGENDA_CONFLICT: ese horario ya está ocupado en la agenda.';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_appointment_agenda ON public.appointments;
CREATE TRIGGER trg_appointment_agenda
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_appointment_agenda();

-- ── Sesiones: la misma comprobación, en el otro sentido ─────────────────────
CREATE OR REPLACE FUNCTION public.enforce_session_agenda()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelada' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE'
     AND NEW.scheduled_at IS NOT DISTINCT FROM OLD.scheduled_at
     AND NEW.duration_minutes IS NOT DISTINCT FROM OLD.duration_minutes
     AND OLD.status <> 'cancelada' THEN
    RETURN NEW; -- no cambia de hueco
  END IF;

  PERFORM agenda_lock(NEW.therapist_id, NEW.patient_id);

  IF agenda_hay_conflicto(
       NEW.therapist_id, NEW.patient_id,
       NEW.scheduled_at, NEW.scheduled_at + make_interval(mins => NEW.duration_minutes),
       NEW.appointment_id, NEW.id) THEN
    RAISE EXCEPTION 'AGENDA_CONFLICT: ese horario ya está ocupado en la agenda.';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_session_agenda ON public.therapy_sessions;
CREATE TRIGGER trg_session_agenda
  BEFORE INSERT OR UPDATE ON public.therapy_sessions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_session_agenda();

-- ── Confirmar una cita materializa su sesión ────────────────────────────────
--
-- Misma transacción que el UPDATE que la confirma: si la sesión no se puede
-- crear —porque el hueco se ocupó entretanto—, la excepción sube y la cita NO
-- queda confirmada. Aceptar y agendar son un solo hecho o no son ninguno.
CREATE OR REPLACE FUNCTION public.materialize_session_on_confirm()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'requested' AND NEW.status = 'confirmed' THEN
    INSERT INTO therapy_sessions (
      patient_id, therapist_id, scheduled_at, duration_minutes,
      status, notes, appointment_id
    ) VALUES (
      NEW.patient_id, NEW.therapist_id, NEW.starts_at,
      greatest(1, (extract(epoch FROM NEW.ends_at - NEW.starts_at) / 60)::int),
      'confirmada', NEW.notes, NEW.id
    );

  -- Cancelar la cita libera el hueco: su sesión se cancela con ella.
  ELSIF OLD.status IN ('requested', 'confirmed') AND NEW.status = 'cancelled' THEN
    UPDATE therapy_sessions SET status = 'cancelada'
    WHERE appointment_id = NEW.id AND status <> 'cancelada';

  -- Y completarla o marcarla no-asistida se refleja en la sesión.
  ELSIF NEW.status = 'completed' THEN
    UPDATE therapy_sessions SET status = 'completada' WHERE appointment_id = NEW.id;
  ELSIF NEW.status = 'no_show' THEN
    UPDATE therapy_sessions SET status = 'no_asistio' WHERE appointment_id = NEW.id;
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_materialize_session_on_confirm ON public.appointments;
CREATE TRIGGER trg_materialize_session_on_confirm
  AFTER UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.materialize_session_on_confirm();

-- ── Backfill ────────────────────────────────────────────────────────────────
-- Las 20 sesiones anteriores se conservan intactas: `appointment_id` queda NULL
-- porque no nacieron de una cita, y eso es exactamente lo que ocurrió. No se
-- inventa una cita retroactiva para cada una.
--
-- Tampoco se toca `sessionsService` ni ninguna pantalla: siguen leyendo y
-- escribiendo `therapy_sessions` igual que antes. Lo único que cambia para
-- ellas es que ahora una hora ocupada por una cita también les da conflicto.
