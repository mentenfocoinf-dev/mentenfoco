-- ============================================================================
-- Contraoferta de horario: cadena de solicitudes.
--
-- ── Por qué una cadena y no una cita mutable ────────────────────────────────
--
-- `appointments` es inmutable en fecha y hora por diseño: el trigger
-- `enforce_appointment_rules` rechaza cualquier UPDATE que toque `starts_at` o
-- `ends_at`, y las dos restricciones EXCLUDE impiden solapamientos sobre esos
-- mismos valores. Permitir que una cita cambiara de hora obligaría a relajar las
-- dos cosas a la vez, y dejaría un registro clínico que miente: la cita diría
-- que siempre fue a las 11:00 aunque se pidiera para las 09:00.
--
-- Aquí no se toca nada de eso. Contraofertar es cancelar la solicitud original y
-- crear otra nueva enlazada a ella:
--
--     cita_original (cancelled)  ←── replaces_appointment_id ──  cita_nueva
--
-- El historial queda completo y legible: se ve qué se pidió, qué se propuso a
-- cambio y en qué terminó. Nada se borra ni se sobrescribe.
--
-- ── Lo que se añade, y nada más ─────────────────────────────────────────────
--
--   · una columna, `replaces_appointment_id`
--   · un índice único: una cita se sustituye UNA vez, así la cadena es una
--     cadena y no un árbol de propuestas simultáneas
--   · un trigger propio para las reglas del enlace — no se modifica ninguno de
--     los existentes
--   · una función `propose_new_time()`, porque cancelar y crear tienen que
--     ocurrir en la MISMA transacción: dos llamadas sueltas dejarían la cita
--     original cancelada y al paciente sin propuesta si la segunda falla
--
-- ── Lo que NO se toca ───────────────────────────────────────────────────────
--
-- `enforce_appointment_rules`, `enforce_appointment_agenda`,
-- `materialize_session_on_confirm`, `notify_appointment`, las dos EXCLUDE, los
-- CHECK y el trigger que impide el DELETE quedan exactamente igual.
-- ============================================================================

-- ── El enlace ───────────────────────────────────────────────────────────────
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS replaces_appointment_id uuid
    REFERENCES public.appointments(id) ON DELETE RESTRICT;

COMMENT ON COLUMN public.appointments.replaces_appointment_id IS
  'La solicitud que esta cita viene a sustituir. Solo lo rellena una contraoferta.';

-- Una cita no puede sustituirse a sí misma.
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_no_se_sustituye_a_si_misma;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_no_se_sustituye_a_si_misma
  CHECK (replaces_appointment_id IS NULL OR replaces_appointment_id <> id);

-- Una solicitud se sustituye UNA sola vez. Sin esto, dos contraofertas sobre la
-- misma cita producirían dos propuestas vivas y el paciente tendría que adivinar
-- cuál es la buena.
CREATE UNIQUE INDEX IF NOT EXISTS appointments_una_sola_sustitucion
  ON public.appointments (replaces_appointment_id)
  WHERE replaces_appointment_id IS NOT NULL;

-- ── Reglas del enlace, en su propio trigger ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_appointment_chain()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  origen record;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- El enlace es parte del historial: se escribe al nacer y no se retoca.
    IF NEW.replaces_appointment_id IS DISTINCT FROM OLD.replaces_appointment_id THEN
      RAISE EXCEPTION 'APPOINTMENT_CHAIN_IMMUTABLE: el enlace con la solicitud anterior no se cambia.';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.replaces_appointment_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO origen FROM appointments WHERE id = NEW.replaces_appointment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'APPOINTMENT_CHAIN_NOT_FOUND: la solicitud que se sustituye no existe.';
  END IF;

  -- Una contraoferta pertenece al mismo proceso que la solicitud que reemplaza.
  -- Sin esto, el enlace podría cruzar pacientes.
  IF origen.relationship_id IS DISTINCT FROM NEW.relationship_id THEN
    RAISE EXCEPTION 'APPOINTMENT_CHAIN_MISMATCH: esa solicitud es de otro proceso.';
  END IF;

  -- La original tiene que estar ya cancelada. Es lo que impide que una
  -- contraoferta deje dos solicitudes vivas por el mismo motivo.
  IF origen.status <> 'cancelled' THEN
    RAISE EXCEPTION 'APPOINTMENT_CHAIN_ORIGIN_ALIVE: primero se cancela la solicitud original.';
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_appointment_chain ON public.appointments;
CREATE TRIGGER trg_appointment_chain
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_appointment_chain();

-- ── Contraofertar, en una sola transacción ──────────────────────────────────
--
-- SECURITY DEFINER por los privilegios de tabla, NO para saltarse reglas:
-- `auth.uid()` sigue devolviendo al profesional, así que
-- `enforce_appointment_rules` y `enforce_appointment_agenda` se aplican igual
-- que si escribiera directamente. Franja declarada, solapamientos, relación
-- activa y cita en el pasado se siguen comprobando.
CREATE OR REPLACE FUNCTION public.propose_new_time(
  p_appointment_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_message text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  original record;
  quien    uuid := auth.uid();
  nueva    uuid;
BEGIN
  IF quien IS NULL THEN
    RAISE EXCEPTION 'APPOINTMENT_FORBIDDEN: esta cita no es tuya.';
  END IF;

  SELECT * INTO original FROM appointments WHERE id = p_appointment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'APPOINTMENT_CHAIN_NOT_FOUND: esa solicitud no existe.';
  END IF;

  -- Proponer otro horario es del profesional. El paciente que quiere otra hora
  -- cancela y pide de nuevo: no necesita una vía aparte.
  IF quien <> original.therapist_id THEN
    RAISE EXCEPTION 'APPOINTMENT_FORBIDDEN: esta cita no es tuya.';
  END IF;

  IF original.status <> 'requested' THEN
    RAISE EXCEPTION 'APPOINTMENT_CLOSED: esta cita ya está cerrada.';
  END IF;

  -- Cancelar primero libera el hueco y deja pasar la comprobación de
  -- solapamiento si la propuesta cae sobre la hora original.
  UPDATE appointments SET status = 'cancelled' WHERE id = p_appointment_id;

  INSERT INTO appointments (
    relationship_id, patient_id, therapist_id, starts_at, ends_at,
    status, created_by, notes, replaces_appointment_id
  ) VALUES (
    original.relationship_id, original.patient_id, original.therapist_id,
    p_starts_at, p_ends_at, 'requested', quien,
    nullif(btrim(coalesce(p_message, '')), ''), p_appointment_id
  )
  RETURNING id INTO nueva;

  RETURN nueva;
END
$$;

COMMENT ON FUNCTION public.propose_new_time(uuid, timestamptz, timestamptz, text) IS
  'Contraoferta: cancela la solicitud original y crea otra enlazada, en la misma transacción.';

REVOKE ALL ON FUNCTION public.propose_new_time(uuid, timestamptz, timestamptz, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.propose_new_time(uuid, timestamptz, timestamptz, text) TO authenticated;

-- ── Lectura: que el enlace llegue al cliente ────────────────────────────────
--
-- DROP + CREATE porque CREATE OR REPLACE no puede cambiar el tipo de retorno.
--
-- `list_my_appointments` pasa además de INNER a LEFT JOIN sobre
-- `therapist_profiles`: con el INNER, un profesional sin ficha profesional hacía
-- desaparecer sus citas de la lista del paciente. Con contraofertas eso sería
-- peor —el paciente no vería la propuesta que tiene que responder—, así que se
-- corrige aquí.
DROP FUNCTION IF EXISTS public.list_my_appointments();

CREATE FUNCTION public.list_my_appointments()
RETURNS TABLE (
  id uuid, relationship_id uuid, counterpart_name text,
  starts_at timestamptz, ends_at timestamptz, status appointment_status,
  notes text, created_by uuid, replaces_appointment_id uuid
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT a.id, a.relationship_id, coalesce(t.professional_name, p.full_name, ''),
         a.starts_at, a.ends_at, a.status, a.notes, a.created_by,
         a.replaces_appointment_id
  FROM appointments a
  LEFT JOIN therapist_profiles t ON t.profile_id = a.therapist_id
  LEFT JOIN profiles p ON p.id = a.therapist_id
  WHERE auth.uid() IS NOT NULL AND a.patient_id = auth.uid()
  ORDER BY a.starts_at DESC
$$;

REVOKE ALL ON FUNCTION public.list_my_appointments() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_my_appointments() TO authenticated;

DROP FUNCTION IF EXISTS public.list_therapist_appointments();

CREATE FUNCTION public.list_therapist_appointments()
RETURNS TABLE (
  id uuid, relationship_id uuid, counterpart_name text,
  starts_at timestamptz, ends_at timestamptz, status appointment_status,
  notes text, created_by uuid, replaces_appointment_id uuid
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT a.id, a.relationship_id, p.full_name,
         a.starts_at, a.ends_at, a.status, a.notes, a.created_by,
         a.replaces_appointment_id
  FROM appointments a
  JOIN profiles p ON p.id = a.patient_id
  WHERE auth.uid() IS NOT NULL AND a.therapist_id = auth.uid()
  ORDER BY a.starts_at ASC
$$;

REVOKE ALL ON FUNCTION public.list_therapist_appointments() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_therapist_appointments() TO authenticated;
