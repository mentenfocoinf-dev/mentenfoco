-- ============================================================================
-- Disponibilidad: dejar las cuatro fuentes separadas y con su sitio.
--
-- La disponibilidad de un profesional es, a la larga:
--
--     horario laboral
--   − sesiones confirmadas
--   − solicitudes pendientes
--   − bloqueos manuales
--
-- Hoy `available_hours` resuelve dos de las cuatro y las tiene mezcladas dentro
-- de su propio WHERE:
--
--   · horario laboral      → aproximado por `franja_de()` contra la franja
--                            declarada en `therapist_profiles.availability`
--                            (mañanas / tardes / noches / fines de semana)
--   · sesiones + solicitudes → `agenda_hay_conflicto()`, la MISMA función que
--                            usa el trigger al insertar
--   · bloqueos manuales    → no existe
--
-- Este sprint no implementa horarios laborales. Lo que hace es dejar el sitio
-- hecho para que añadirlos —y añadir bloqueos— no obligue a volver a tocar
-- `available_hours` ni el trigger:
--
--   1. `agenda_bloqueo_manual()` existe ya como punto de extensión. Hoy contesta
--      siempre `false` porque no hay tabla de bloqueos. Cuando la haya, se
--      reemplaza el cuerpo de esta función y TODO lo que la consulta se entera a
--      la vez: el selector del paciente y, si se decide, el trigger.
--
--   2. `hora_ocupada()` compone las fuentes de "resta" en un único sitio. Es la
--      pregunta que hay que hacerse para saber si una hora está tomada, y ahora
--      tiene una sola respuesta en toda la base.
--
--   3. Las dos versiones de `available_hours` dejan de duplicar lógica: la
--      antigua —la que recibe `date`— delega en la nueva. Dos implementaciones
--      del mismo cálculo acaban divergiendo, y la que diverge es siempre la que
--      nadie mira.
--
-- Un apunte deliberado: `agenda_bloqueo_manual` NO se enchufa todavía al trigger
-- `enforce_appointment_agenda`. Un stub que siempre dice `false` no cambiaría
-- nada hoy, pero el día que devuelva `true` estaría alterando qué INSERT se
-- acepta desde un archivo que nadie relee. Cuando existan los bloqueos, esa
-- conexión se hace explícita y se prueba.
-- ============================================================================

-- ── Punto de extensión: bloqueos manuales ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.agenda_bloqueo_manual(
  p_therapist_id uuid,
  p_inicio timestamptz,
  p_fin timestamptz
)
RETURNS boolean
LANGUAGE sql IMMUTABLE
AS $$
  -- Todavía no hay bloqueos manuales. Cuando exista la tabla, este cuerpo pasa
  -- a ser un EXISTS contra ella y no hay que tocar nada más.
  SELECT false
$$;

COMMENT ON FUNCTION public.agenda_bloqueo_manual(uuid, timestamptz, timestamptz) IS
  'Punto de extensión para bloqueos manuales de agenda. Hoy siempre false: no existe la tabla.';

-- ── Una sola pregunta: ¿está tomada esta hora? ──────────────────────────────
CREATE OR REPLACE FUNCTION public.hora_ocupada(
  p_therapist_id uuid,
  p_patient_id uuid,
  p_inicio timestamptz,
  p_fin timestamptz
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT agenda_hay_conflicto(p_therapist_id, p_patient_id, p_inicio, p_fin)
      OR agenda_bloqueo_manual(p_therapist_id, p_inicio, p_fin)
$$;

COMMENT ON FUNCTION public.hora_ocupada(uuid, uuid, timestamptz, timestamptz) IS
  'Compone las fuentes que restan disponibilidad: sesiones, solicitudes vivas y bloqueos manuales.';

-- ── available_hours pasa a apoyarse en hora_ocupada ─────────────────────────
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
     OR p_hasta_instante > p_desde_instante + interval '48 hours' THEN
    RETURN;
  END IF;

  SELECT * INTO rel FROM patient_therapist WHERE id = p_relationship_id;
  IF NOT FOUND OR rel.status <> 'active' THEN RETURN; END IF;

  IF auth.uid() IS NULL
     OR (auth.uid() <> rel.patient_id AND auth.uid() <> rel.therapist_id) THEN
    RETURN;
  END IF;

  SELECT * INTO perfil FROM therapist_profiles WHERE profile_id = rel.therapist_id;

  RETURN QUERY
  SELECT h
  FROM generate_series(p_desde_instante, p_hasta_instante, interval '1 hour') AS h
  WHERE h > now()
    -- Horario laboral (aproximado por ahora con la franja declarada).
    AND (perfil.profile_id IS NULL
         OR array_length(perfil.availability, 1) IS NULL
         OR franja_de(h) = ANY (perfil.availability))
    -- Sesiones + solicitudes + bloqueos manuales.
    AND NOT hora_ocupada(rel.therapist_id, rel.patient_id, h, h + interval '1 hour')
  ORDER BY h;
END
$$;

-- La versión por `date` deja de tener lógica propia: delega. Se mantiene solo
-- porque ya está concedida y puede haber quien la llame.
CREATE OR REPLACE FUNCTION public.available_hours(
  p_relationship_id uuid,
  p_dia date,
  p_desde integer DEFAULT 7,
  p_hasta integer DEFAULT 19
)
RETURNS TABLE (hora timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT a.hora FROM available_hours(
    p_relationship_id,
    (p_dia::timestamp + make_interval(hours => greatest(0, p_desde)))::timestamptz,
    (p_dia::timestamp + make_interval(hours => least(23, p_hasta)))::timestamptz
  ) a;
END
$$;

COMMENT ON FUNCTION public.available_hours(uuid, date, integer, integer) IS
  'Obsoleta: la ventana se arma con el huso del SERVIDOR. Usa la variante por instantes. Delega en ella.';

REVOKE ALL ON FUNCTION public.agenda_bloqueo_manual(uuid, timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hora_ocupada(uuid, uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.agenda_bloqueo_manual(uuid, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hora_ocupada(uuid, uuid, timestamptz, timestamptz) TO authenticated;
