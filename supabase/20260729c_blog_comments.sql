-- ============================================================================
-- Comentarios del blog, con moderacion previa.
--
-- El blog deja de ser una lista de articulos y pasa a ser un espacio de
-- comunidad: un terapeuta publica y los pacientes aportan tecnicas y
-- recomendaciones para otros. En una plataforma de salud mental eso NO puede
-- salir en vivo: un comentario puede traer consejo danino, datos personales o
-- una senal de riesgo que alguien tiene que ver antes que el publico.
--
-- Por eso el estado por defecto es 'pendiente' y aprobarlo es un acto
-- deliberado de un moderador. Como en el resto del proyecto, la barrera REAL es
-- un TRIGGER: con RLS apagado en pruebas, una policy no filtra nada.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'comment_status') THEN
    CREATE TYPE comment_status AS ENUM ('pendiente', 'aprobado', 'rechazado');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS blog_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     uuid NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  author_id   uuid NOT NULL REFERENCES profiles(id),
  body        text NOT NULL,
  status      comment_status NOT NULL DEFAULT 'pendiente',
  reviewed_by uuid REFERENCES profiles(id),
  reviewed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT blog_comments_body_no_vacio_check
    CHECK (btrim(body) <> ''),
  -- Un comentario resuelto (aprobado o rechazado) dice quien lo resolvio y
  -- cuando: sin eso la moderacion no es auditable.
  CONSTRAINT blog_comments_revision_completa_check
    CHECK (
      status = 'pendiente'
      OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
    )
);

-- El listado publico de un post: aprobados, del mas antiguo al mas nuevo.
CREATE INDEX IF NOT EXISTS blog_comments_post_idx
  ON blog_comments (post_id, status, created_at);

-- La cola de moderacion del admin.
CREATE INDEX IF NOT EXISTS blog_comments_cola_idx
  ON blog_comments (status, created_at DESC);

-- "Mis comentarios" del paciente dentro de un post.
CREATE INDEX IF NOT EXISTS blog_comments_autor_idx
  ON blog_comments (author_id, created_at DESC);

-- ── Solo se comenta en un post de blog que admite comentarios ────────────────
-- Un FK no alcanza: content_items tiene los cinco tipos, y `post_id` debe
-- apuntar a uno de blog, publicado y abierto. Se valida en el mismo trigger de
-- moderacion para no multiplicar disparadores sobre la tabla.

-- ── LA REGLA: nadie autopublica su propio comentario ─────────────────────────
--
-- Aprobar es competencia del admin y, opcionalmente, del terapeuta autor del
-- post (modera su propia conversacion). El paciente solo puede crear en
-- 'pendiente' y nunca puede cambiar el estado de nada, ni siquiera de lo suyo.
--
-- auth.uid() NULL = contexto de servidor de confianza (service_role: seeds y
-- migraciones), igual que en enforce_content_publish_is_admin.
CREATE OR REPLACE FUNCTION enforce_blog_comment_moderation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor        uuid := auth.uid();
  v_role         text;
  v_post_type    content_type;
  v_post_status  content_status;
  v_post_abierto boolean;
  v_post_autor   uuid;
  v_puede_moderar boolean;
BEGIN
  -- El destino tiene que ser un post de blog publicado y con comentarios
  -- abiertos. Se comprueba tambien en contexto de servidor: una siembra mal
  -- apuntada es un error de datos, no un permiso.
  IF TG_OP = 'INSERT' THEN
    SELECT content_type, status, admite_comentarios, author_id
      INTO v_post_type, v_post_status, v_post_abierto, v_post_autor
      FROM content_items WHERE id = NEW.post_id;

    IF v_post_type IS DISTINCT FROM 'blog' THEN
      RAISE EXCEPTION 'BLOG_COMMENT_TARGET_INVALID: solo se comenta en piezas de tipo blog.';
    END IF;
    IF v_post_status IS DISTINCT FROM 'publicado' THEN
      RAISE EXCEPTION 'BLOG_COMMENT_TARGET_INVALID: el post no esta publicado.';
    END IF;
    IF v_post_abierto IS NOT TRUE THEN
      RAISE EXCEPTION 'BLOG_COMMENT_CLOSED: este post no admite comentarios.';
    END IF;
  ELSE
    SELECT author_id INTO v_post_autor FROM content_items WHERE id = NEW.post_id;
  END IF;

  IF v_actor IS NULL THEN
    RETURN NEW;  -- service_role / migracion
  END IF;

  SELECT role::text INTO v_role FROM profiles WHERE id = v_actor;
  v_puede_moderar := (v_role = 'admin') OR (v_role = 'therapist' AND v_actor = v_post_autor);

  IF TG_OP = 'INSERT' THEN
    -- Nadie nace aprobado. Ni el propio moderador se salta la cola creando ya
    -- resuelto: si quiere publicar algo suyo, lo crea y lo aprueba, y asi queda
    -- registrado quien lo aprobo.
    IF NEW.status <> 'pendiente' THEN
      RAISE EXCEPTION 'BLOG_COMMENT_SELF_PUBLISH_FORBIDDEN: un comentario nuevo entra siempre en revision.';
    END IF;
    -- Nadie comenta en nombre de otro.
    IF NEW.author_id <> v_actor THEN
      RAISE EXCEPTION 'BLOG_COMMENT_AUTHOR_MISMATCH: no se puede comentar en nombre de otra persona.';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: cambiar el estado es moderar.
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT v_puede_moderar THEN
    RAISE EXCEPTION 'BLOG_COMMENT_MODERATION_FORBIDDEN: solo un administrador o el terapeuta autor del post modera comentarios.';
  END IF;

  IF NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by AND NOT v_puede_moderar THEN
    RAISE EXCEPTION 'BLOG_COMMENT_MODERATION_FORBIDDEN: solo un moderador asigna reviewed_by.';
  END IF;

  -- El texto no se reescribe despues de aprobado: aprobar un texto y publicar
  -- otro vaciaria de sentido la moderacion.
  IF NEW.body IS DISTINCT FROM OLD.body AND OLD.status = 'aprobado' THEN
    RAISE EXCEPTION 'BLOG_COMMENT_IMMUTABLE: un comentario aprobado ya no se edita.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_blog_comment_moderation ON blog_comments;
CREATE TRIGGER trg_blog_comment_moderation
  BEFORE INSERT OR UPDATE ON blog_comments
  FOR EACH ROW EXECUTE FUNCTION enforce_blog_comment_moderation();

-- ============================================================================
-- FASE DE SEGURIDAD (no aplicar todavia: RLS esta desactivado a proposito en
-- todo el proyecto; ver 00 Indice maestro / Decisiones tecnicas).
--
-- Mientras RLS siga apagado, la barrera REAL es el trigger de arriba, que si
-- esta activo. El filtrado de LECTURA (publico ve solo 'aprobado'; el paciente
-- ve ademas los suyos en 'pendiente') lo hace hoy blogCommentsService.ts.
--
-- ALTER TABLE blog_comments ENABLE ROW LEVEL SECURITY;
--
-- -- Cualquiera lee los aprobados.
-- CREATE POLICY blog_comments_select_aprobados ON blog_comments
--   FOR SELECT USING (status = 'aprobado');
--
-- -- El autor ve los suyos en cualquier estado.
-- CREATE POLICY blog_comments_select_propios ON blog_comments
--   FOR SELECT USING (author_id = auth.uid());
--
-- -- Admin y terapeuta autor del post ven todo lo que moderan.
-- CREATE POLICY blog_comments_select_moderadores ON blog_comments
--   FOR SELECT USING (
--     EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
--     OR EXISTS (
--       SELECT 1 FROM content_items c JOIN profiles p ON p.id = auth.uid()
--        WHERE c.id = blog_comments.post_id AND p.role = 'therapist' AND c.author_id = auth.uid()
--     )
--   );
--
-- -- Comentar: uno mismo, y siempre en revision. El estado tambien lo cubre el
-- -- trigger; la policy lo repite para que la regla siga siendo legible aqui.
-- CREATE POLICY blog_comments_insert_propio ON blog_comments
--   FOR INSERT WITH CHECK (author_id = auth.uid() AND status = 'pendiente');
--
-- -- Moderar: solo admin o terapeuta autor del post.
-- CREATE POLICY blog_comments_update_moderadores ON blog_comments
--   FOR UPDATE USING (
--     EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
--     OR EXISTS (
--       SELECT 1 FROM content_items c JOIN profiles p ON p.id = auth.uid()
--        WHERE c.id = blog_comments.post_id AND p.role = 'therapist' AND c.author_id = auth.uid()
--     )
--   );
-- ============================================================================
