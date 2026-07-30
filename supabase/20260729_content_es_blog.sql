-- ============================================================================
-- Blog publico: marca curatorial `es_blog`.
--
-- /contenido y /blog no son la misma cosa aunque compartan tabla:
--   /contenido = biblioteca del miembro, escalonada por plan (sin candados).
--   /blog      = vitrina publica y SEO, sin sesion, SOLO articulos free.
--
-- La regla de /blog es "articulo AND min_plan='free'". `es_blog` no amplia ese
-- conjunto: distingue las piezas escritas expresamente para el publico general
-- (mas divulgativas) para poder destacarlas. Por eso el CHECK la ata a free: un
-- articulo de plan pago marcado como blog seria una filtracion de contenido.
-- ============================================================================

ALTER TABLE content_items
  ADD COLUMN IF NOT EXISTS es_blog boolean NOT NULL DEFAULT false;

-- Una pieza de blog es siempre un articulo publico. Sin esto, un descuido al
-- asignar min_plan expondria contenido de pago en una ruta sin login.
ALTER TABLE content_items
  DROP CONSTRAINT IF EXISTS content_items_es_blog_is_free_article_check;
ALTER TABLE content_items
  ADD CONSTRAINT content_items_es_blog_is_free_article_check
  CHECK (
    es_blog = false
    OR (content_type = 'articulo' AND min_plan = 'free')
  );

-- La vista de metadatos alimenta los listados; /blog filtra por aqui.
-- `es_blog` va al final: CREATE OR REPLACE no permite reordenar columnas de una
-- vista existente (intercalarla se lee como renombrar `tags`).
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
    published_at,
    es_blog
  FROM content_items;

-- Listado publico del blog: articulos free publicados, los de blog primero.
CREATE INDEX IF NOT EXISTS content_items_blog_idx
  ON content_items (content_type, min_plan, status, published_at DESC);
