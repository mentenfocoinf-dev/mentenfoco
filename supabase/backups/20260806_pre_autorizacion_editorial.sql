-- ============================================================================
-- BACKUP — estado de la autorización sobre `content_items` ANTES del sprint 4B.
-- Capturado de pg_proc y pg_trigger el 2026-08-06.
--
-- ── Estado de partida ───────────────────────────────────────────────────────
--
-- Triggers sobre content_items (los dos, BEFORE):
--
--   trg_content_items_updated_at   BEFORE UPDATE          -> set_content_items_updated_at()
--   trg_content_publish_is_admin   BEFORE INSERT OR UPDATE -> enforce_content_publish_is_admin()
--
-- ACL: sin cambios en este sprint. `authenticated` conserva `arwxtm`.
-- RLS: OFF. Políticas: ninguna sobre content_items.
--
-- ── Qué revierte este archivo ───────────────────────────────────────────────
--
-- 1. Elimina el trigger nuevo y su función.
-- 2. Restaura `trg_content_publish_is_admin`, que la migración consolida.
--
-- La función `enforce_content_publish_is_admin()` NO se borra en la migración
-- —solo se le retira el trigger—, así que aquí basta con volver a colgarla.
-- Se transcribe igualmente su cuerpo por si alguien la eliminara después:
--
--   CREATE OR REPLACE FUNCTION public.enforce_content_publish_is_admin()
--   RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
--   AS $function$
--   DECLARE
--     v_actor uuid := auth.uid();
--     v_role  text;
--   BEGIN
--     IF v_actor IS NULL THEN
--       RETURN NEW;  -- service_role / migracion
--     END IF;
--     SELECT role::text INTO v_role FROM profiles WHERE id = v_actor;
--     IF v_role = 'admin' THEN RETURN NEW; END IF;
--     IF NEW.status = 'publicado'
--        AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'publicado') THEN
--       RAISE EXCEPTION 'CONTENT_PUBLISH_FORBIDDEN: solo un administrador puede publicar contenido.';
--     END IF;
--     IF NEW.published_by IS NOT NULL
--        AND (TG_OP = 'INSERT' OR OLD.published_by IS DISTINCT FROM NEW.published_by) THEN
--       RAISE EXCEPTION 'CONTENT_PUBLISH_FORBIDDEN: solo un administrador puede asignar published_by.';
--     END IF;
--     RETURN NEW;
--   END;
--   $function$;
-- ============================================================================

DROP TRIGGER IF EXISTS trg_content_authorization ON public.content_items;
DROP FUNCTION IF EXISTS public.enforce_content_authorization();

DROP TRIGGER IF EXISTS trg_content_publish_is_admin ON public.content_items;
CREATE TRIGGER trg_content_publish_is_admin
  BEFORE INSERT OR UPDATE ON public.content_items
  FOR EACH ROW EXECUTE FUNCTION public.enforce_content_publish_is_admin();
