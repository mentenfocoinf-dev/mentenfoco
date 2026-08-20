-- ============================================================================
-- Agenda clínica: enlazar sesión con cita, y calcular disponibilidad real.
--
-- Dos cosas que faltaban para que la agenda sea usable:
--
-- 1. `list_my_sessions()` no devolvía `appointment_id`, así que desde la cita
--    confirmada no había forma de llegar a su sesión —y por tanto de guardar el
--    enlace de la videollamada ni las observaciones—. Se añade la columna.
--    Requiere DROP + CREATE porque CREATE OR REPLACE no puede cambiar el tipo
--    de retorno de una función.
--
-- 2. El paciente elegía hora a ciegas y descubría al enviar que estaba ocupada.
--    `available_hours()` devuelve las horas LIBRES de un día, cruzando lo que
--    ya impide el solapamiento: sesiones clínicas vivas, citas solicitadas o
--    confirmadas, y la franja que el profesional declaró.
--
-- Sobre privacidad: `available_hours` NO dice qué hay en las horas ocupadas —
-- solo cuáles quedan libres. Y solo responde a quien es parte de la relación.
-- Nadie puede sondear la agenda de un profesional con el que no tiene proceso.
-- ============================================================================

DROP FUNCTION IF EXISTS public.list_my_sessions();

CREATE FUNCTION public.list_my_sessions()
RETURNS TABLE (
  id uuid, patient_id uuid, therapist_id uuid, scheduled_at timestamptz,
  duration_minutes integer, status text, video_call_link text,
  reminder_status text, notes text, created_at timestamptz, updated_at timestamptz,
  appointment_id uuid, counterpart_name text, counterpart_email text
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT s.id, s.patient_id, s.therapist_id, s.scheduled_at,
         s.duration_minutes, s.status, s.video_call_link,
         s.reminder_status, s.notes, s.created_at, s.updated_at,
         s.appointment_id, p.full_name, p.email
  FROM therapy_sessions s
  JOIN profiles p ON p.id = CASE WHEN s.patient_id = auth.uid() THEN s.therapist_id
                                 ELSE s.patient_id END
  WHERE auth.uid() IS NOT NULL
    AND (s.patient_id = auth.uid() OR s.therapist_id = auth.uid())
  ORDER BY s.scheduled_at ASC
$$;

REVOKE ALL ON FUNCTION public.list_my_sessions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_my_sessions() TO authenticated;

-- ── Horas libres de un día ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.available_hours(
  p_relationship_id uuid,
  p_dia date,
  p_desde integer DEFAULT 7,
  p_hasta integer DEFAULT 19
)
RETURNS TABLE (hora timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE
AS $$
DECLARE
  rel record;
  perfil record;
BEGIN
  SELECT * INTO rel FROM patient_therapist WHERE id = p_relationship_id;
  IF NOT FOUND OR rel.status <> 'active' THEN RETURN; END IF;

  -- Solo las dos partes pueden preguntar por esta agenda.
  IF auth.uid() IS NULL
     OR (auth.uid() <> rel.patient_id AND auth.uid() <> rel.therapist_id) THEN
    RETURN;
  END IF;

  SELECT * INTO perfil FROM therapist_profiles WHERE profile_id = rel.therapist_id;

  RETURN QUERY
  SELECT h
  FROM generate_series(
         (p_dia::timestamp + make_interval(hours => greatest(0, p_desde)))::timestamptz,
         (p_dia::timestamp + make_interval(hours => least(23, p_hasta)))::timestamptz,
         interval '1 hour') AS h
  WHERE h > now()
    -- La franja que el profesional declaró. Si no declaró ninguna, no se filtra.
    AND (perfil.profile_id IS NULL
         OR array_length(perfil.availability, 1) IS NULL
         OR franja_de(h) = ANY (perfil.availability))
    -- Y que el hueco esté libre de verdad, con la misma comprobación que impide
    -- el solapamiento al insertar. Así el selector no ofrece lo que la base va
    -- a rechazar.
    AND NOT agenda_hay_conflicto(rel.therapist_id, rel.patient_id, h, h + interval '1 hour')
  ORDER BY h;
END
$$;

COMMENT ON FUNCTION public.available_hours(uuid, date, integer, integer) IS
  'Horas libres de un día para una relación activa. No revela qué ocupa las horas tomadas.';

REVOKE ALL ON FUNCTION public.available_hours(uuid, date, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.available_hours(uuid, date, integer, integer) TO authenticated;
