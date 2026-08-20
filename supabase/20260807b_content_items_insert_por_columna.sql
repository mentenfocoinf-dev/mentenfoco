-- ============================================================================
-- `content_items`: se cierra el ALTA. Simétrico al sprint 4D, que ya había
-- cerrado la modificación.
--
-- Alcance: la ACL de INSERT y la rama de INSERT del trigger de autorización.
-- No se toca React, ni la ACL de UPDATE, ni RLS, ni otras tablas, ni otros
-- roles. La rama de MODIFICACIÓN del trigger queda literalmente igual.
--
-- ── La asimetría que corrige ────────────────────────────────────────────────
--
-- El 4D dejó `UPDATE` acotado a 17 de 32 columnas, pero el `INSERT` seguía
-- siendo permiso de tabla sin restricción de columna, y la rama de alta del
-- trigger solo validaba autoría, estado inicial y trazabilidad. Medido en la
-- auditoría 4E, como PACIENTE:
--
--     paciente crea un borrador     LOGRADO — un paciente, no solo un terapeuta
--     fija min_plan en el INSERT    LOGRADO
--     columnas sin GRANT, al crear  LOGRADO — cover_image, tags, theme_key…
--     falsear created_at al crear   LOGRADO — created_at=2001-01-01
--     elegir el id al crear         LOGRADO
--     reservar un slug libre        LOGRADO — bloquea una URL futura
--     creacion masiva               LOGRADO — 500 piezas en UNA sentencia
--
-- Es decir: se podía fijar en el alta exactamente lo que después quedaba
-- protegido en la edición.
--
-- ── Las 9 columnas que se conceden, y por qué esas ──────────────────────────
--
-- Son, ni más ni menos, las que nombra `createContentDraft`
-- (`contentService.ts:328`), único punto de alta del proyecto:
--
--     .insert({ ...input, author_id: authorId, status: "borrador" })
--
-- donde `input` es el payload de `ContentEditorModal:80-92`, montado solo desde
-- `AdminDashboard:822` y `TherapistDashboard:1013` — `PatientDashboard` no
-- tiene ninguna referencia a contenido.
--
--   content_type · audio_kind · categoria · titulo · resumen_breve ·
--   tiempo_lectura · body_md      → los 7 campos del editor
--   author_id                     → lo envía el frontend; el trigger ya lo
--                                   fuerza a ser uno mismo. NOT NULL sin
--                                   default: no se puede omitir.
--   status                        → lo envía el frontend; el trigger ya lo
--                                   fuerza a `borrador` para quien no es admin.
--
-- ── Las 23 que se retiran, por grupos ───────────────────────────────────────
--
-- Automáticas (4) — NOT NULL con default, así que omitirlas es seguro:
--   id (gen_random_uuid) · created_at (now) · updated_at (now) ·
--   admite_comentarios (true)
--
-- Exclusivas del flujo editorial (9) — las fija la administración al revisar o
-- publicar, nunca quien crea. `min_plan` tiene default `'free'`, así que el
-- alta funciona sin nombrarla:
--   slug · min_plan · reviewed_by · reviewed_at · review_notes ·
--   published_by · published_at · meta_title · meta_description
--
-- Exclusivas de enriquecimiento (10) — hoy las siembra `service_role`, que
-- conserva el INSERT de tabla íntegro; ningún `.insert(` del frontend las
-- nombra:
--   cover_image · en_resumen · faq · key_takeaway · clinical_refs ·
--   audio_url · external_embed_url · program_steps · tags · theme_key
--
-- 9 + 4 + 9 + 10 = 32.
--
-- ── El rol: lo único que la ACL no puede expresar ───────────────────────────
--
-- Un `GRANT` distingue columnas, no personas. Que un PACIENTE no pueda crear
-- contenido solo puede comprobarse dentro del trigger, así que la rama de
-- INSERT pasa a exigir `role IN ('therapist','admin')`. Si el perfil no existe,
-- el rol es NULL y las dos comparaciones `IS DISTINCT FROM` dan cierto: falla
-- cerrado, que es lo que queremos.
--
-- Se conserva la comprobación de `published_by/at` y `reviewed_by/at` en el
-- alta aunque el GRANT ya las haga inalcanzables para `authenticated`. Es la
-- misma redundancia deliberada del 4D: el privilegio solo alcanza a
-- `authenticated`, el trigger cubre además cualquier rol futuro.
--
-- ── Idempotencia ────────────────────────────────────────────────────────────
--
-- `REVOKE ... ON TABLE` retira también las concesiones por columna del mismo
-- privilegio, así que la segunda pasada las quita y el `GRANT` las repone. El
-- estado final es idéntico. `CREATE OR REPLACE FUNCTION` es idempotente por
-- definición. Aplicada dos veces con éxito.
--
-- ── Reversión ───────────────────────────────────────────────────────────────
--
-- `supabase/backups/20260807_pre_content_items_insert_por_columna.sql`
-- ============================================================================

REVOKE INSERT ON TABLE public.content_items FROM authenticated;

GRANT INSERT (
  content_type,
  audio_kind,
  categoria,
  titulo,
  resumen_breve,
  tiempo_lectura,
  body_md,
  author_id,
  status
) ON TABLE public.content_items TO authenticated;

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
  rol_perfil text;
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

  SELECT p.role::text INTO rol_perfil FROM profiles p WHERE p.id = quien;
  es_admin := (rol_perfil = 'admin');
  es_admin := coalesce(es_admin, false);

  -- ══════════════════ ALTA ══════════════════
  IF TG_OP = 'INSERT' THEN
    -- Escribir en la plataforma es parte del trabajo clínico, no del uso de
    -- ella. Un perfil sin rol reconocido tampoco pasa: falla cerrado.
    IF rol_perfil IS DISTINCT FROM 'admin'
       AND rol_perfil IS DISTINCT FROM 'therapist' THEN
      RAISE EXCEPTION 'CONTENT_AUTHOR_ROLE: solo el equipo clínico y la administración crean contenido.';
    END IF;

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
  -- Sin cambios respecto al sprint 4B. Se transcribe íntegra porque
  -- `CREATE OR REPLACE FUNCTION` sustituye el cuerpo entero.

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
  'Autorización editorial de content_items: identidad, rol, autoría, estado y columnas. Alta restringida al equipo clínico y a la administración.';
