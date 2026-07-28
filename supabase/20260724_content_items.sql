-- ============================================================================
-- Sistema de contenido de la plataforma (blog / programas / herramientas / audio)
-- con flujo editorial: terapeuta redacta -> admin revisa -> admin publica.
--
-- Modelo unificado en una sola tabla (no 4 paralelas) porque los cuatro tipos
-- comparten el mismo flujo editorial y el mismo gating por plan: asi el panel de
-- revision del admin es una sola cola y el listado una sola consulta.
--
-- Reutiliza el gating ya existente de las guias: plan_type / plan_rank / min_plan.
-- ============================================================================

-- ── Enums ────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'content_type') THEN
    CREATE TYPE content_type AS ENUM ('articulo', 'programa', 'herramienta', 'audio');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audio_kind') THEN
    CREATE TYPE audio_kind AS ENUM ('meditacion', 'podcast');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'content_status') THEN
    CREATE TYPE content_status AS ENUM (
      'borrador',
      'en_revision',
      'cambios_solicitados',
      'aprobado',
      'publicado',
      'archivado'
    );
  END IF;
END $$;

-- ── Tabla principal ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type   content_type NOT NULL,
  audio_kind     audio_kind,
  categoria      text NOT NULL,
  titulo         text NOT NULL,
  slug           text UNIQUE NOT NULL,
  resumen_breve  text NOT NULL,
  cover_image    text,
  tiempo_lectura text,

  -- Cuerpo (markdown, se renderiza con ReactMarkdown igual que las guias)
  body_md        text,
  en_resumen     text[],
  faq            jsonb,
  key_takeaway   text,
  clinical_refs  jsonb,

  -- Audio: null hasta que existan las grabaciones; el resumen del tema ya aporta
  -- valor por si solo, asi que la pieza se publica sin ellos.
  audio_url          text,
  external_embed_url text,

  -- Programa: pasos ordenados, cada uno puede apuntar a otro content_item
  program_steps  jsonb,

  -- Gating y etiquetas
  min_plan       plan_type NOT NULL DEFAULT 'free',
  tags           text[],

  -- Workflow editorial
  status         content_status NOT NULL DEFAULT 'borrador',
  author_id      uuid NOT NULL REFERENCES profiles(id),
  reviewed_by    uuid REFERENCES profiles(id),
  reviewed_at    timestamptz,
  review_notes   text,
  published_by   uuid REFERENCES profiles(id),
  published_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  -- audio_kind solo tiene sentido en piezas de audio
  CONSTRAINT content_items_audio_kind_check
    CHECK (audio_kind IS NULL OR content_type = 'audio'),
  -- una pieza publicada tiene que tener quien la publico y cuando
  CONSTRAINT content_items_published_complete_check
    CHECK (
      status <> 'publicado'
      OR (published_by IS NOT NULL AND published_at IS NOT NULL)
    )
);

COMMENT ON TABLE content_items IS
  'Contenido de la plataforma (articulo/programa/herramienta/audio) con flujo editorial. Solo un admin puede dejar status=publicado (ver trigger enforce_content_publish_is_admin).';
COMMENT ON COLUMN content_items.published_by IS
  'SIEMPRE un admin. Lo garantiza el trigger, no solo la UI.';
COMMENT ON COLUMN content_items.min_plan IS
  'Mismo gating que clinical_guides: plan_rank(min_plan) <= plan_rank(plan del usuario).';

-- ── Indices ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS content_items_status_idx       ON content_items (status);
CREATE INDEX IF NOT EXISTS content_items_type_idx         ON content_items (content_type);
CREATE INDEX IF NOT EXISTS content_items_categoria_idx    ON content_items (categoria);
CREATE INDEX IF NOT EXISTS content_items_slug_idx         ON content_items (slug);
CREATE INDEX IF NOT EXISTS content_items_author_idx       ON content_items (author_id, status);
-- La cola de revision del admin y el listado publico son las dos consultas calientes.
CREATE INDEX IF NOT EXISTS content_items_review_queue_idx ON content_items (created_at DESC)
  WHERE status = 'en_revision';
CREATE INDEX IF NOT EXISTS content_items_published_idx    ON content_items (published_at DESC)
  WHERE status = 'publicado';

-- ── updated_at ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_content_items_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_content_items_updated_at ON content_items;
CREATE TRIGGER trg_content_items_updated_at
  BEFORE UPDATE ON content_items
  FOR EACH ROW EXECUTE FUNCTION set_content_items_updated_at();

-- ── SOLO ADMIN PUBLICA (la regla central del pedido) ─────────────────────────
--
-- Se implementa como TRIGGER, no solo como policy, a proposito: en este proyecto
-- RLS esta desactivado durante la fase de pruebas, y una policy no filtraria
-- nada. El trigger aplica venga la llamada de donde venga (web, movil, script),
-- asi que un terapeuta no puede autopublicarse ni manipulando el cliente.
--
-- auth.uid() NULL = contexto de servidor de confianza (service_role: seeds y
-- migraciones). Ahi no se bloquea, igual que el resto del proyecto asume que la
-- service role key es de confianza.
CREATE OR REPLACE FUNCTION enforce_content_publish_is_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

DROP TRIGGER IF EXISTS trg_content_publish_is_admin ON content_items;
CREATE TRIGGER trg_content_publish_is_admin
  BEFORE INSERT OR UPDATE ON content_items
  FOR EACH ROW EXECUTE FUNCTION enforce_content_publish_is_admin();

-- ── Historial de revisiones ──────────────────────────────────────────────────
-- Guarda el cuerpo previo cuando un admin edita lo que envio un terapeuta, para
-- que el autor pueda ver que se le cambio.
CREATE TABLE IF NOT EXISTS content_revisions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id uuid NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  edited_by       uuid NOT NULL REFERENCES profiles(id),
  previous_body   text,
  previous_status content_status,
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_revisions_item_idx
  ON content_revisions (content_item_id, created_at DESC);

-- ── Vista de metadatos (sin body_md) ─────────────────────────────────────────
-- Equivalente a clinical_guides_meta: permite listar TODAS las piezas publicadas
-- —incluidas las que el usuario no puede leer aun— para mostrarlas con candado,
-- sin exponer nunca el cuerpo del contenido.
CREATE OR REPLACE VIEW content_items_meta AS
  SELECT
    id,
    content_type,
    audio_kind,
    categoria,
    titulo,
    slug,
    resumen_breve,
    cover_image,
    tiempo_lectura,
    min_plan,
    tags,
    status,
    published_at
  FROM content_items;

-- ============================================================================
-- FASE DE SEGURIDAD (no aplicar todavia: RLS esta desactivado a proposito en
-- todo el proyecto; ver 00 Indice maestro / Decisiones tecnicas).
--
-- NOTA: mientras RLS siga apagado, la unica barrera REAL de publicacion es el
-- trigger de arriba (que si esta activo). El filtrado de lectura por estado y
-- plan lo hace hoy la capa de servicios (contentService.ts).
--
-- ALTER TABLE content_items ENABLE ROW LEVEL SECURITY;
--
-- -- Lectura publica: solo publicado y con el plan suficiente.
-- CREATE POLICY "Published content readable by plan" ON content_items
--   FOR SELECT USING (
--     status = 'publicado'
--     AND (plan_rank(min_plan) = 0 OR get_my_plan_rank() >= plan_rank(min_plan))
--   );
--
-- -- El autor ve lo suyo en cualquier estado.
-- CREATE POLICY "Authors read own content" ON content_items
--   FOR SELECT USING (author_id = auth.uid());
--
-- -- El admin ve todo.
-- CREATE POLICY "Admins read all content" ON content_items
--   FOR SELECT USING (get_my_role() = 'admin'::user_role);
--
-- -- Crean terapeutas y admins, siempre como autores de si mismos.
-- CREATE POLICY "Staff create content" ON content_items
--   FOR INSERT WITH CHECK (
--     author_id = auth.uid()
--     AND get_my_role() = ANY (ARRAY['admin'::user_role, 'therapist'::user_role])
--   );
--
-- -- El autor edita lo suyo solo mientras es borrador o le pidieron cambios.
-- CREATE POLICY "Authors update own drafts" ON content_items
--   FOR UPDATE USING (
--     author_id = auth.uid()
--     AND status = ANY (ARRAY['borrador'::content_status, 'cambios_solicitados'::content_status])
--   );
--
-- -- El admin edita siempre.
-- CREATE POLICY "Admins update any content" ON content_items
--   FOR UPDATE USING (get_my_role() = 'admin'::user_role);
--
-- ALTER TABLE content_revisions ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Revisions visible to author and admins" ON content_revisions
--   FOR SELECT USING (
--     get_my_role() = 'admin'::user_role
--     OR EXISTS (
--       SELECT 1 FROM content_items c
--       WHERE c.id = content_revisions.content_item_id AND c.author_id = auth.uid()
--     )
--   );
-- ============================================================================
