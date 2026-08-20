-- ============================================================================
-- Autorización editorial sobre `content_items`.
--
-- Alcance: un trigger. No se tocan ACL, ni RLS, ni RPC, ni React.
--
-- ── Qué cierra, con la evidencia de la auditoría ────────────────────────────
--
-- Un paciente cualquiera conseguía, sobre contenido cuyo autor era el admin:
--
--     A01 cambiar titulo ajeno: SI
--     A02 reescribir body_md ajeno: SI
--     A03 cambiar slug ajeno: SI
--     A04 apropiarse (author_id): SI
--     A06 falsear reviewed_by: SI
--     A07 despublicar todo (status): 26 piezas
--     A09 liberar contenido de pago (min_plan): 16 piezas
--     A10 cambiar la clave primaria (id): SI
--
-- Solo A05 y A08 fallaban, y por el único control que existía:
-- `trg_content_publish_is_admin`.
--
-- ── Consolidación ──────────────────────────────────────────────────────────
--
-- Este trigger sustituye funcionalmente a `trg_content_publish_is_admin`: sus
-- dos reglas —nadie salvo el admin publica, nadie salvo el admin asigna
-- `published_by`— quedan absorbidas aquí. Se retira el trigger antiguo.
--
-- Dejar los dos activos habría significado dos criterios distintos sobre la
-- misma tabla, y el antiguo trae además el patrón que ya corregimos en las
-- funciones `admin_*`:
--
--     IF v_actor IS NULL THEN RETURN NEW;   -- se desactiva entero sin sesión
--
-- Aquí la ausencia de sesión NO abre nada: es un rechazo explícito. Lo único
-- que pasa sin comprobación es `service_role` o una conexión sin JWT (las
-- migraciones), que es lo que el resto del esquema ya considera «sistema».
--
-- La función `enforce_content_publish_is_admin()` se conserva sin trigger, para
-- que revertir sea volver a colgarla.
--
-- ── Tres desviaciones respecto al ADR, todas por evidencia del código ───────
--
-- 1. El ADR fijaba T7 como `aprobado -> publicado`. NO se implementa así: el
--    panel ofrece «Publicar» desde tres sitios y con estados distintos —cola de
--    revisión (`AdminDashboard:514`, estado `en_revision`), listado general
--    (`AdminDashboard:568`, cualquier estado salvo publicado y archivado) y el
--    propio editor (`AdminDashboard:833`, cualquier estado salvo publicado,
--    incluido `archivado`)—. Exigir el origen `aprobado` habría roto los tres.
--
-- 2. El ADR declaraba `archivado` terminal. Tampoco: `AdminDashboard:833`
--    ofrece publicar sobre una pieza archivada, así que desarchivar publicando
--    es un camino real del panel.
--
-- 3. El ADR limitaba la edición de contenido a `borrador` y
--    `cambios_solicitados` para todos. Se aplica solo a quien NO es admin:
--    `AdminDashboard:564` ofrece «Editar» sin condición de estado. El panel del
--    terapeuta sí condiciona ya la edición a esos dos estados
--    (`TherapistDashboard:1019-1020`), así que para él la regla de base
--    coincide con la interfaz.
--
-- El resultado: el admin conserva la libertad editorial que la interfaz le da;
-- quien no es admin queda encerrado en su propio contenido y en su ventana de
-- edición. A07 y A09 se cierran igualmente, porque quien los ejecutó era un
-- paciente.
--
-- ── Idempotencia ───────────────────────────────────────────────────────────
--
-- `CREATE OR REPLACE FUNCTION` + `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER`.
-- Ejecutable las veces que haga falta.
--
-- ── Reversión ──────────────────────────────────────────────────────────────
--
-- `supabase/backups/20260806_pre_autorizacion_editorial.sql`
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enforce_content_authorization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  quien      uuid := auth.uid();
  -- `nullif(...,'')` es la guarda que ya usa `enforce_blog_comment_moderation`:
  -- sin ella, unos claims en cadena vacía revientan el cast a json.
  rol        text := coalesce(
                       nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
                       '');
  es_sistema boolean := (rol = 'service_role') OR (quien IS NULL AND rol = '');
  es_admin   boolean;
  es_autor   boolean;
BEGIN
  -- Escrituras del sistema: migraciones y clave de servidor.
  IF es_sistema THEN
    RETURN NEW;
  END IF;

  -- Sin sesión no se escribe. Deliberadamente NO se devuelve NEW aquí.
  IF quien IS NULL THEN
    RAISE EXCEPTION 'CONTENT_AUTH_REQUIRED: hace falta iniciar sesión para escribir contenido.';
  END IF;

  SELECT p.role = 'admin' INTO es_admin FROM profiles p WHERE p.id = quien;
  es_admin := coalesce(es_admin, false);

  -- ══════════════════ ALTA ══════════════════
  IF TG_OP = 'INSERT' THEN
    -- Los dos paneles pasan `authorId={profile.id}`: nadie crea a nombre ajeno.
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

  -- Inmutables para todo el mundo. `id` es la clave que referencian
  -- `blog_comments` y `content_revisions`; `author_id` es la autoría.
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'CONTENT_IMMUTABLE: el identificador de una pieza no se cambia.';
  END IF;
  IF NEW.author_id IS DISTINCT FROM OLD.author_id THEN
    RAISE EXCEPTION 'CONTENT_IMMUTABLE: la autoría de una pieza no se cambia.';
  END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'CONTENT_IMMUTABLE: la fecha de creación no se cambia.';
  END IF;

  -- ── Administración ──
  IF es_admin THEN
    -- Nadie firma en nombre de otro, tampoco un administrador.
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

  -- ── Quien no es administración ──
  es_autor := (quien = OLD.author_id);
  IF NOT es_autor THEN
    RAISE EXCEPTION 'CONTENT_NOT_AUTHOR: solo puedes editar el contenido que has escrito.';
  END IF;

  -- Campos que solo fija la administración.
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

  -- Cambio de estado: la única transición del autor es enviar a revisión,
  -- desde borrador o desde cambios solicitados.
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (OLD.status IN ('borrador', 'cambios_solicitados')
            AND NEW.status = 'en_revision') THEN
      RAISE EXCEPTION 'CONTENT_INVALID_TRANSITION: desde % solo puedes enviar a revisión.', OLD.status;
    END IF;
    -- Al reenviar se limpian las notas; no se escriben.
    IF NEW.review_notes IS NOT NULL THEN
      RAISE EXCEPTION 'CONTENT_ADMIN_ONLY: las notas de revisión las escribe la administración.';
    END IF;
    RETURN NEW;
  END IF;

  -- Edición de contenido: solo mientras la pieza está en tus manos.
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

COMMENT ON FUNCTION public.enforce_content_authorization() IS
  'Autorización editorial de content_items: identidad, autoría, rol, estado y columnas. Sustituye a enforce_content_publish_is_admin.';

DROP TRIGGER IF EXISTS trg_content_authorization ON public.content_items;
CREATE TRIGGER trg_content_authorization
  BEFORE INSERT OR UPDATE ON public.content_items
  FOR EACH ROW EXECUTE FUNCTION public.enforce_content_authorization();

-- Consolidación: se retira el trigger antiguo. Su función se conserva sin
-- colgar, para que la reversión sea volver a crear el trigger.
DROP TRIGGER IF EXISTS trg_content_publish_is_admin ON public.content_items;
