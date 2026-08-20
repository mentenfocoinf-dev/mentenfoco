-- ============================================================================
-- BACKUP — estado del ALTA en `public.content_items` ANTES del sprint 4F.
-- Capturado de `pg_class.relacl`, `pg_attribute` y `pg_proc` el 2026-08-07.
--
-- ── Estado de partida ───────────────────────────────────────────────────────
--
--   relacl: {postgres=arwdDxtm/postgres,
--            anon=rm/postgres,
--            authenticated=arm/postgres,
--            service_role=arwdDxtm/postgres}
--
--   `authenticated` tiene INSERT A NIVEL DE TABLA (`a`), sin GRANT OPTION.
--   Ninguna columna tiene `attacl` de INSERT: las 32 son escribibles en el alta
--   precisamente porque el privilegio viene de la tabla.
--
--   Función de autorización: `enforce_content_authorization()`, owner postgres,
--   SECURITY DEFINER, search_path = public, pg_temp, md5 del cuerpo
--   `d199637f8546`. Su rama de INSERT validaba SOLO tres cosas: autoría propia,
--   estado inicial `borrador` para quien no es admin, y los cuatro campos de
--   trazabilidad en NULL para quien no es admin. NO comprobaba el rol, así que
--   un paciente podía crear contenido.
--
-- ── Qué revierte este archivo ───────────────────────────────────────────────
--
-- 1. Devuelve el INSERT de tabla y borra las concesiones por columna que
--    introduce la migración (el `REVOKE ... ON TABLE` retira también las
--    concesiones de ese privilegio a nivel de columna; por eso va primero).
-- 2. Restaura la función con su rama de INSERT original, sin comprobación de
--    rol.
--
-- Idempotente: ejecutarlo dos veces deja el mismo estado.
-- ============================================================================

REVOKE INSERT ON TABLE public.content_items FROM authenticated;
GRANT  INSERT ON TABLE public.content_items TO   authenticated;

CREATE OR REPLACE FUNCTION public.enforce_content_authorization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  quien      uuid := auth.uid();
  rol        text := coalesce(
                       nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
                       '');
  es_sistema boolean := (rol = 'service_role') OR (quien IS NULL AND rol = '');
  es_admin   boolean;
  es_autor   boolean;
BEGIN
  IF es_sistema THEN
    RETURN NEW;
  END IF;

  IF quien IS NULL THEN
    RAISE EXCEPTION 'CONTENT_AUTH_REQUIRED: hace falta iniciar sesión para escribir contenido.';
  END IF;

  SELECT p.role = 'admin' INTO es_admin FROM profiles p WHERE p.id = quien;
  es_admin := coalesce(es_admin, false);

  -- ══════════════════ ALTA ══════════════════
  IF TG_OP = 'INSERT' THEN
    IF NEW.author_id IS DISTINCT FROM quien THEN
      RAISE EXCEPTION 'CONTENT_AUTHOR_MISMATCH: el contenido se crea a nombre propio.';
    END IF;

    IF NOT es_admin THEN
      IF NEW.status <> 'borrador' THEN
        RAISE EXCEPTION 'CONTENT_INITIAL_STATE: el contenido nace como borrador.';
      END IF;
      IF NEW.published_by IS NOT NULL OR NEW.published_at IS NOT NULL
         OR NEW.reviewed_by IS NOT NULL OR NEW.reviewed_at IS NOT NULL THEN
        RAISE EXCEPTION 'CONTENT_ADMIN_ONLY: los campos de revisión y publicación los fija la administración.';
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  -- ══════════════════ MODIFICACIÓN ══════════════════
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'CONTENT_IMMUTABLE: el identificador de una pieza no se cambia.';
  END IF;
  IF NEW.author_id IS DISTINCT FROM OLD.author_id THEN
    RAISE EXCEPTION 'CONTENT_IMMUTABLE: la autoría de una pieza no se cambia.';
  END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'CONTENT_IMMUTABLE: la fecha de creación no se cambia.';
  END IF;

  IF es_admin THEN
    IF NEW.published_by IS DISTINCT FROM OLD.published_by
       AND NEW.published_by IS DISTINCT FROM quien THEN
      RAISE EXCEPTION 'CONTENT_SIGN_SELF: published_by se firma con la propia identidad.';
    END IF;
    IF NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
       AND NEW.reviewed_by IS DISTINCT FROM quien THEN
      RAISE EXCEPTION 'CONTENT_SIGN_SELF: reviewed_by se firma con la propia identidad.';
    END IF;
    RETURN NEW;
  END IF;

  es_autor := (quien = OLD.author_id);
  IF NOT es_autor THEN
    RAISE EXCEPTION 'CONTENT_NOT_AUTHOR: solo puedes editar el contenido que has escrito.';
  END IF;

  IF NEW.slug IS DISTINCT FROM OLD.slug
     OR NEW.meta_title IS DISTINCT FROM OLD.meta_title
     OR NEW.meta_description IS DISTINCT FROM OLD.meta_description
     OR NEW.min_plan IS DISTINCT FROM OLD.min_plan
     OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
     OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
     OR NEW.published_by IS DISTINCT FROM OLD.published_by
     OR NEW.published_at IS DISTINCT FROM OLD.published_at THEN
    RAISE EXCEPTION 'CONTENT_ADMIN_ONLY: la URL, el SEO, el plan y la trazabilidad los fija la administración.';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (OLD.status IN ('borrador', 'cambios_solicitados')
            AND NEW.status = 'en_revision') THEN
      RAISE EXCEPTION 'CONTENT_INVALID_TRANSITION: desde % solo puedes enviar a revisión.', OLD.status;
    END IF;
    IF NEW.review_notes IS NOT NULL THEN
      RAISE EXCEPTION 'CONTENT_ADMIN_ONLY: las notas de revisión las escribe la administración.';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status NOT IN ('borrador', 'cambios_solicitados') THEN
    RAISE EXCEPTION 'CONTENT_LOCKED: una pieza en % ya no la edita su autor.', OLD.status;
  END IF;

  IF NEW.review_notes IS DISTINCT FROM OLD.review_notes
     AND NEW.review_notes IS NOT NULL THEN
    RAISE EXCEPTION 'CONTENT_ADMIN_ONLY: las notas de revisión las escribe la administración.';
  END IF;

  RETURN NEW;
END
$$;
