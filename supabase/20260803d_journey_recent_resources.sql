-- ============================================================================
-- journey_recent_resources() — lo último que abrió quien pregunta.
--
-- Hermana de `journey_seen_resources`, con la misma forma de seguridad y por la
-- misma razón: el cliente NO tiene SELECT sobre journey_events y no debe
-- tenerlo. Con RLS desactivado, un GRANT dejaría leer el recorrido de cualquier
-- persona, y una secuencia de eventos es información de salud de facto.
--
-- La diferencia con la hermana es la pregunta que responde. Aquélla contesta
-- "¿de estos recursos que ya conoces, cuáles ha abierto?" y sirve para saber
-- por dónde va un programa. Ésta contesta "¿qué abrió último?" y es lo que
-- permite retomar la navegación sin que la persona tenga que acordarse.
--
--   · SECURITY DEFINER, para leer la tabla sin dar SELECT a nadie;
--   · filtra por auth.uid() DENTRO, no por parámetro: no hay dónde escribir el
--     identificador de otra persona;
--   · sin sesión devuelve vacío, no error;
--   · devuelve identificador, tipo y cuándo. Nunca el evento completo, ni la
--     página, ni los utm, ni el resto del recorrido;
--   · STABLE y sin efectos.
--
-- No se crea ninguna tabla: el recorrido ya está en journey_events.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.journey_recent_resources(p_limit integer DEFAULT 5)
RETURNS TABLE (resource_id text, resource_type text, last_seen_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    e.metadata->>'resource_id'   AS resource_id,
    -- El tipo del evento más reciente de ese recurso: si una pieza cambió de
    -- tipo, manda el último que se vio.
    (array_agg(e.metadata->>'resource_type' ORDER BY e.created_at DESC))[1] AS resource_type,
    max(e.created_at)            AS last_seen_at
  FROM journey_events e
  WHERE auth.uid() IS NOT NULL
    AND e.user_id = auth.uid()
    -- Abrir una pieza es la señal de recorrido que ya existe. No se inventa otra.
    AND e.event_name IN ('CONTENT_VIEW', 'GUIDE_VIEW', 'BLOG_VIEW')
    AND e.metadata->>'resource_id' IS NOT NULL
  GROUP BY e.metadata->>'resource_id'
  ORDER BY max(e.created_at) DESC
  LIMIT greatest(1, least(coalesce(p_limit, 5), 20))
$$;

COMMENT ON FUNCTION public.journey_recent_resources(integer) IS
  'Últimos recursos abiertos por quien llama. Solo el propio recorrido: filtra por auth.uid() internamente. Sin sesión devuelve vacío.';

-- Se concede a anon a propósito: sin sesión devuelve vacío, así el cliente no
-- tiene que distinguir entre "no hay recorrido" y "no puedo preguntar".
REVOKE ALL ON FUNCTION public.journey_recent_resources(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.journey_recent_resources(integer) TO anon, authenticated;
