-- ============================================================================
-- Particiones de `realtime.messages` — sin esto, Broadcast no emite nada.
--
-- ── El problema encontrado ──────────────────────────────────────────────────
--
-- `realtime.messages` está particionada por día. En esta base la última
-- partición existente era `messages_2026_08_01` y hoy es el 4 de agosto: todo
-- INSERT caía en "no partition of relation found for row".
--
-- Y falla EN SILENCIO. El código de `realtime.send` envuelve su INSERT en un
-- bloque que convierte cualquier error en `RAISE WARNING`, así que la llamada
-- devuelve éxito, el trigger no se entera y el aviso simplemente no existe. Se
-- descubrió porque los avisos no aparecían por ningún lado, no porque nada
-- diera error.
--
-- ── Lo que se hace aquí ─────────────────────────────────────────────────────
--
-- 1. Crear las particiones que faltan y un colchón hacia adelante.
-- 2. Dejar un trabajo de `pg_cron` que las siga creando. Sin él esto vuelve a
--    romperse en cuanto se agote el colchón, otra vez en silencio.
--
-- No se toca ninguna tabla del producto: `realtime` es infraestructura de
-- Supabase y aquí solo se repone lo que su propio mantenimiento debía crear.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ensure_realtime_partitions(p_dias integer DEFAULT 30)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  d date;
  nombre text;
  creadas integer := 0;
BEGIN
  -- Desde ayer, para cubrir husos por detrás de UTC.
  FOR d IN SELECT generate_series(current_date - 1, current_date + p_dias, '1 day')::date LOOP
    nombre := 'messages_' || to_char(d, 'YYYY_MM_DD');
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'realtime' AND c.relname = nombre
    ) THEN
      EXECUTE format(
        'CREATE TABLE realtime.%I PARTITION OF realtime.messages FOR VALUES FROM (%L) TO (%L)',
        nombre, d, d + 1);
      creadas := creadas + 1;
    END IF;
  END LOOP;
  RETURN creadas;
END
$$;

COMMENT ON FUNCTION public.ensure_realtime_partitions(integer) IS
  'Repone las particiones diarias de realtime.messages. Sin ellas, realtime.send falla en silencio y Broadcast deja de emitir.';

SELECT public.ensure_realtime_partitions(60);

-- Mantenimiento: una vez al día. El trabajo de recordatorios ya usa pg_cron en
-- esta base, así que no se introduce ninguna dependencia nueva.
SELECT cron.unschedule('ensure-realtime-partitions')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ensure-realtime-partitions');

SELECT cron.schedule(
  'ensure-realtime-partitions', '17 3 * * *',
  $$SELECT public.ensure_realtime_partitions(30)$$
);

REVOKE ALL ON FUNCTION public.ensure_realtime_partitions(integer) FROM PUBLIC;
