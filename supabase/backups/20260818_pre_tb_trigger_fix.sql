-- ============================================================================
-- BACKUP previo a 20260818_tb_trigger_fix.sql   (R5 — cierra H-TB-001)
--
-- Definición EXACTA de public.enforce_time_block_ownership el 18 de agosto de
-- 2026, ANTES del fix. Capturada con pg_get_functiondef(). El rollback restaura
-- esta definición literal.
--
-- ESTADO CAPTURADO (baseline vivo de R5):
--   md5(prosrc) ............. 5411ff3c763b55c6c73285246472dbe2
--   huella FUNCTIONS global . e5e288e79a4b6f5b9364d7ffe902b7e1
--   huella TRIGGERS global .. 3ca1288a327c51ad66d698009c86eb79
--   therapist_time_blocks ... 0 filas
--   trigger (NO cambia):
--     CREATE TRIGGER trg_time_block_ownership BEFORE INSERT OR DELETE OR UPDATE
--     ON public.therapist_time_blocks FOR EACH ROW
--     EXECUTE FUNCTION enforce_time_block_ownership()
--
-- El defecto H-TB-001: la rama de bypass devolvía RETURN NEW también en DELETE,
-- y como en un BEFORE DELETE NEW es NULL, cancelaba la fila en silencio.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.enforce_time_block_ownership()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  quien uuid := auth.uid();
  rol   text := coalesce(current_setting('request.jwt.claims', true)::json->>'role', '');
BEGIN
  IF (rol = 'service_role') OR (quien IS NULL AND rol = '') THEN RETURN NEW; END IF;

  IF TG_OP = 'DELETE' THEN
    IF quien IS DISTINCT FROM OLD.therapist_id THEN
      RAISE EXCEPTION 'BLOCK_FORBIDDEN: ese bloqueo no es tuyo.';
    END IF;
    RETURN OLD;
  END IF;

  -- Derivado, no aceptado de fuera.
  NEW.therapist_id := quien;

  IF TG_OP = 'UPDATE' AND OLD.therapist_id IS DISTINCT FROM quien THEN
    RAISE EXCEPTION 'BLOCK_FORBIDDEN: ese bloqueo no es tuyo.';
  END IF;

  -- Bloquear el pasado no sirve para nada y esconde errores de fecha.
  IF NEW.ends_at <= now() THEN
    RAISE EXCEPTION 'BLOCK_IN_THE_PAST: no se bloquea un rango que ya pasó.';
  END IF;

  -- Un bloqueo no puede caer encima de algo ya agendado: primero se resuelve lo
  -- que hay. Si no, quedarían sesiones dentro de unas vacaciones.
  IF EXISTS (
    SELECT 1 FROM therapy_sessions s
    WHERE s.therapist_id = NEW.therapist_id
      AND s.status NOT IN ('cancelada', 'completada', 'no_asistio')
      AND tstzrange(s.scheduled_at, s.scheduled_at + make_interval(mins => s.duration_minutes))
          && tstzrange(NEW.starts_at, NEW.ends_at)
  ) OR EXISTS (
    SELECT 1 FROM appointments a
    WHERE a.therapist_id = NEW.therapist_id
      AND a.status IN ('requested', 'confirmed')
      AND tstzrange(a.starts_at, a.ends_at) && tstzrange(NEW.starts_at, NEW.ends_at)
  ) THEN
    RAISE EXCEPTION 'BLOCK_OVERLAPS_AGENDA: hay citas o sesiones dentro de ese rango.';
  END IF;

  RETURN NEW;
END
$function$;

COMMIT;

-- ============================================================================
-- REGLA 1 — el catálogo demuestra el estado restaurado
-- ============================================================================
SELECT
  (SELECT md5(p.prosrc) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='enforce_time_block_ownership')       AS md5_prosrc,
  (SELECT md5(string_agg(pp.proname||':'||md5(pp.prosrc),'|' ORDER BY pp.proname,pp.oid))
    FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace
    WHERE nn.nspname='public')                                                   AS huella_functions,
  (SELECT count(*) FROM public.therapist_time_blocks)                            AS filas;
