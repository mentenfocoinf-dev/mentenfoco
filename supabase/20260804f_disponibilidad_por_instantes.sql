-- ============================================================================
-- Disponibilidad: que la ventana la fije el cliente, no el huso del servidor.
--
-- ── El defecto ──────────────────────────────────────────────────────────────
--
-- `available_hours(uuid, date, integer, integer)` arma la ventana así:
--
--     (p_dia::timestamp + make_interval(hours => 7))::timestamptz
--
-- Ese cast usa el huso de la SESIÓN, que en el pool de Supabase es UTC. O sea:
-- pide "de 7 a 19" y devuelve de 07:00Z a 19:00Z, que en Colombia son las 02:00
-- y las 14:00. El paciente vería madrugada como horario disponible y no vería
-- ninguna tarde a partir de las 15:00.
--
-- Es el mismo error de huso ya reportado en `franja_de()`, aquí con consecuencia
-- visible: un selector que ofrece horas equivocadas.
--
-- ── La corrección ───────────────────────────────────────────────────────────
--
-- El servidor no puede saber en qué huso vive quien pregunta, así que deja de
-- adivinarlo: esta sobrecarga recibe los dos INSTANTES ya resueltos. El
-- navegador sí conoce el huso del paciente y manda "las 07:00 y las 19:00 de su
-- día" convertidas a UTC. La base solo responde qué queda libre entre ellos.
--
-- Los nombres de los parámetros son distintos (`p_desde_instante`) a propósito:
-- PostgREST resuelve las sobrecargas por el conjunto de nombres, y dos funciones
-- con `p_desde` de tipos diferentes es una ambigüedad esperando a ocurrir.
--
-- La versión por `date` se mantiene: no hay que romper lo aplicado, y su
-- comportamiento sigue siendo correcto para un servidor en UTC.
--
-- ── Lo que NO cambia ────────────────────────────────────────────────────────
--
-- Las comprobaciones son exactamente las mismas: relación activa, quien pregunta
-- es parte de ella, franja declarada por el profesional y `agenda_hay_conflicto`.
-- Sigue sin revelar QUÉ ocupa las horas tomadas — solo cuáles quedan libres.
--
-- `franja_de()` se sigue evaluando en UTC. Eso es deliberado: el trigger que
-- valida el INSERT usa esa misma función, y un selector que ofreciera horas que
-- el trigger va a rechazar sería peor que uno con la franja corrida. Cuando se
-- corrija el huso de `franja_de()`, esto se corrige solo.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.available_hours(
  p_relationship_id uuid,
  p_desde_instante timestamptz,
  p_hasta_instante timestamptz
)
RETURNS TABLE (hora timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE
AS $$
DECLARE
  rel record;
  perfil record;
BEGIN
  IF p_desde_instante IS NULL OR p_hasta_instante IS NULL
     OR p_hasta_instante <= p_desde_instante
     -- Tope de cordura: nadie necesita preguntar por más de dos días, y sin
     -- techo esto es un generador de series arbitrariamente largo.
     OR p_hasta_instante > p_desde_instante + interval '48 hours' THEN
    RETURN;
  END IF;

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
  FROM generate_series(p_desde_instante, p_hasta_instante, interval '1 hour') AS h
  WHERE h > now()
    AND (perfil.profile_id IS NULL
         OR array_length(perfil.availability, 1) IS NULL
         OR franja_de(h) = ANY (perfil.availability))
    AND NOT agenda_hay_conflicto(rel.therapist_id, rel.patient_id, h, h + interval '1 hour')
  ORDER BY h;
END
$$;

COMMENT ON FUNCTION public.available_hours(uuid, timestamptz, timestamptz) IS
  'Horas libres entre dos instantes para una relación activa. La ventana la fija quien pregunta, porque el servidor no conoce su huso horario.';

REVOKE ALL ON FUNCTION public.available_hours(uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.available_hours(uuid, timestamptz, timestamptz) TO authenticated;
