-- ============================================================================
-- BACKUP — residuos heredados del modelo editorial, ANTES del sprint 4H.
-- Capturado con `pg_get_functiondef()` el 2026-08-07.
--
-- ── Qué había ───────────────────────────────────────────────────────────────
--
-- `public.enforce_content_publish_is_admin()`: función de trigger **huérfana**
-- desde el sprint 4B. Sin ningún trigger colgado, sin ninguna función que la
-- nombre, sin entradas en `pg_depend`, y no invocable directamente (devuelve
-- `trigger`: *"trigger functions can only be called as triggers"*). Se conservó
-- entonces para poder revertir el 4B.
--
-- Es la única función del esquema que contenía `CONTENT_PUBLISH_FORBIDDEN`, así
-- que con ella desaparece ese código de error de la base.
--
-- Estado que NO toca este backup, y que la migración tampoco cambia:
--   ACL de content_items: {postgres=arwdDxtm,anon=rm,authenticated=rm,
--                          service_role=arwdDxtm}
--   enforce_content_authorization(): md5 7b5d32042c327716c9c8b7c6db3a79d3
--   triggers: trg_content_authorization, trg_content_items_updated_at
--
-- ── Qué revierte este archivo ───────────────────────────────────────────────
--
-- 1. Restaura la función, transcrita literalmente de `pg_get_functiondef()`,
--    con su `SECURITY DEFINER` y su `search_path TO 'public'` originales.
--
-- 2. Para restaurar la rama muerta del frontend, devolver a
--    `src/lib/api/contentService.ts`, al principio de `translateWriteError`:
--
--        if (message.includes("CONTENT_PUBLISH_FORBIDDEN")) {
--          return "Solo un administrador puede publicar contenido.";
--        }
--
--    (Ese bloque traducía el error del trigger `trg_content_publish_is_admin`,
--    retirado en el 4B; ningún trigger vigente puede emitirlo.)
--
-- No se restauran los `GRANT` de EXECUTE porque no se retiran: la función se
-- elimina entera, con su ACL. `CREATE OR REPLACE` deja `EXECUTE` para PUBLIC
-- por defecto, que es como estaba (anon/authenticated/service_role = true).
--
-- Idempotente: ejecutarlo dos veces deja el mismo estado.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enforce_content_publish_is_admin()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_role  text;
BEGIN
  IF v_actor IS NULL THEN
    RETURN NEW;  -- service_role / migracion
  END IF;

  SELECT role::text INTO v_role FROM profiles WHERE id = v_actor;

  IF v_role = 'admin' THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'publicado'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'publicado') THEN
    RAISE EXCEPTION 'CONTENT_PUBLISH_FORBIDDEN: solo un administrador puede publicar contenido.';
  END IF;

  IF NEW.published_by IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.published_by IS DISTINCT FROM NEW.published_by) THEN
    RAISE EXCEPTION 'CONTENT_PUBLISH_FORBIDDEN: solo un administrador puede asignar published_by.';
  END IF;

  RETURN NEW;
END;
$function$;
