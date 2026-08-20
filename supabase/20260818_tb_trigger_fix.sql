-- ============================================================================
-- R5 — cierra H-TB-001: enforce_time_block_ownership cancelaba en silencio el
-- DELETE de service_role (y de la ruta sin sesión).
--
-- EL DEFECTO, medido en el sprint de user_preferences/therapist_time_blocks y
-- reconfirmado el 18-ago:
--
--   La rama de bypass hacía `RETURN NEW` para CUALQUIER operación. En un
--   BEFORE DELETE, NEW es NULL, y devolver NULL CANCELA la fila sin error:
--     service_role DELETE -> ROW_COUNT=0, sin error, filas intactas.
--
-- EL FIX — mínimo, solo la rama de bypass respeta TG_OP:
--
--   DELETE            -> RETURN OLD   (deja proceder el borrado)
--   no-DELETE         -> RETURN NEW   (comportamiento previo intacto)
--
--   NO se toca ninguna otra rama: ni la comprobación de propiedad del DELETE de
--   usuario (BLOCK_FORBIDDEN), ni la derivación NEW.therapist_id := auth.uid(),
--   ni el BLOCK_FORBIDDEN de UPDATE, ni BLOCK_IN_THE_PAST, ni
--   BLOCK_OVERLAPS_AGENDA. Es un CREATE OR REPLACE con una única línea cambiada.
--
-- ALCANCE DE LA RAMA: la condición `(rol='service_role') OR (quien IS NULL AND
-- rol='')` NO se modifica. Cubre service_role y la ruta de sistema sin sesión;
-- las dos tenían el mismo bug y las dos quedan corregidas. Corregir solo una
-- dejaría el defecto a medias.
--
-- DECLARACIÓN EXPLÍCITA DE HUELLAS:
--   · CAMBIA la huella FUNCTIONS (el cuerpo de la función cambia).
--   · NO cambia el trigger `trg_time_block_ownership` (pg_get_triggerdef es
--     idéntico: apunta a la misma función con el mismo timing y eventos), así
--     que la huella TRIGGERS —que se calcula con pg_get_triggerdef— NO cambia.
--
-- Backup: supabase/backups/20260818_pre_tb_trigger_fix.sql
-- Diagnóstico: contexto-proyecto/auditorias-tecnicas/Diagnostico_Seguridad_Post_RLS_2026-08-14.md
--
-- Idempotente: CREATE OR REPLACE aplicado varias veces deja la misma definición.
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
  -- Rama de bypass (service_role y sistema sin sesión). Ahora respeta TG_OP:
  -- en un BEFORE DELETE hay que devolver OLD, no NEW (NEW es NULL y cancelaría
  -- la fila en silencio). H-TB-001.
  IF (rol = 'service_role') OR (quien IS NULL AND rol = '') THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

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
-- REGLA 1 — el catálogo demuestra el estado final
-- ============================================================================
SELECT
  (SELECT md5(p.prosrc) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='enforce_time_block_ownership')       AS md5_prosrc,
  (SELECT p.prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='enforce_time_block_ownership')       AS security_definer,
  (SELECT array_to_string(p.proconfig,',') FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='enforce_time_block_ownership')       AS search_path,
  (SELECT md5(string_agg(pp.proname||':'||md5(pp.prosrc),'|' ORDER BY pp.proname,pp.oid))
    FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace WHERE nn.nspname='public') AS huella_functions,
  (SELECT md5(string_agg(c.relname||':'||tg.tgname||':'||pg_get_triggerdef(tg.oid),'|' ORDER BY c.relname,tg.tgname))
    FROM pg_trigger tg JOIN pg_class c ON c.oid=tg.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND NOT tg.tgisinternal)                            AS huella_triggers,
  (SELECT pg_get_triggerdef(tg.oid) FROM pg_trigger tg
    WHERE tg.tgrelid='public.therapist_time_blocks'::regclass AND NOT tg.tgisinternal
      AND tg.tgname='trg_time_block_ownership')                                  AS triggerdef,
  (SELECT count(*) FROM public.therapist_time_blocks)                            AS filas;
