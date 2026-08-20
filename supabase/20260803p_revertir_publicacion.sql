-- ============================================================================
-- CORRECCIÓN: devolver `messages` a la publicación de postgres_changes.
--
-- ── Qué pasó ────────────────────────────────────────────────────────────────
--
-- La migración 20260803n sacó `messages` de `supabase_realtime` dando por hecho
-- que Broadcast la sustituiría. Broadcast NO puede funcionar en esta base:
-- `realtime.messages` está particionada por día, la última partición es del
-- 2026-08-01, y crear las que faltan exige ser dueño del esquema `realtime`
-- (`supabase_admin`). El rol de las migraciones (`postgres`) no lo es y no
-- puede escalar.
--
-- Entre una cosa y la otra, la mensajería en tiempo real quedó rota: ni
-- postgres_changes (tabla fuera de la publicación) ni Broadcast (el INSERT en
-- realtime.messages falla y `realtime.send` se traga el error). Esto lo repara.
--
-- ── Qué se conserva ─────────────────────────────────────────────────────────
--
-- Los triggers de Broadcast, la política de `realtime.messages` y la función de
-- particiones se quedan. No molestan —los triggers no pueden romper un INSERT—
-- y el día que existan particiones empiezan a emitir sin tocar nada más.
--
-- ── Qué NO se hizo, y por qué ───────────────────────────────────────────────
--
-- NO se ejecutó `REVOKE SELECT ON messages FROM authenticated`. Sin Broadcast
-- funcionando, quitar ese permiso deja la mensajería sin tiempo real, que es
-- exactamente el cambio funcional que el sprint prohíbe.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END
$$;
