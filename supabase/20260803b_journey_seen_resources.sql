-- ============================================================================
-- journey_seen_resources() — leer el propio recorrido, y solo el propio.
--
-- El Journey Engine se diseñó de escritura únicamente: `anon` y `authenticated`
-- tienen INSERT sobre journey_events y NO tienen SELECT. Es deliberado — con RLS
-- desactivado, un GRANT SELECT dejaría que cualquier usuario autenticado leyera
-- el recorrido de cualquier otro, y la secuencia de eventos de una persona es
-- información de salud de facto (ADR-005, ADR-013).
--
-- Pero "cuál es tu siguiente paso" necesita saber qué has abierto ya. Esta
-- función es la única grieta que se abre, y es del tamaño exacto del problema:
--
--   · SECURITY DEFINER, para poder leer la tabla sin dar SELECT a nadie;
--   · filtra por auth.uid() DENTRO de la función, no por un parámetro. Nadie
--     puede pedir el recorrido de otra persona porque no hay dónde escribirlo;
--   · sin sesión devuelve vacío, no error: un visitante anónimo simplemente
--     empieza por el primer paso;
--   · devuelve solo identificadores de recursos que quien llama YA conoce
--     —los pasos del programa que está mirando—, nunca el recorrido completo;
--   · STABLE y sin efectos: no puede escribir nada.
--
-- No se crea ninguna tabla: el progreso ya está en journey_events.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.journey_seen_resources(p_resource_ids text[])
RETURNS TABLE (resource_id text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT DISTINCT e.metadata->>'resource_id'
  FROM journey_events e
  WHERE auth.uid() IS NOT NULL
    AND e.user_id = auth.uid()
    -- Abrir una pieza es la señal de progreso que ya existe. No se inventa otra.
    AND e.event_name IN ('CONTENT_VIEW', 'GUIDE_VIEW')
    AND e.metadata->>'resource_id' = ANY (p_resource_ids)
$$;

COMMENT ON FUNCTION public.journey_seen_resources(text[]) IS
  'Cuáles de los recursos indicados ha abierto ya quien llama. Solo el propio recorrido: filtra por auth.uid() internamente. Sin sesión devuelve vacío.';

-- Se concede a anon a propósito: con sesión nula la función devuelve vacío, y
-- así el cliente no tiene que distinguir entre "no hay progreso" y "no puedo
-- preguntar". Un camino menos que pueda fallar delante del usuario.
REVOKE ALL ON FUNCTION public.journey_seen_resources(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.journey_seen_resources(text[]) TO anon, authenticated;
