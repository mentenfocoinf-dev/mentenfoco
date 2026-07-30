-- ============================================================================
-- Separacion estricta Guias / Contenido / Blog (regla 29-jul).
--
-- Antes el blog era un "espejo": /blog listaba los articulos free de Contenido
-- mas dos piezas marcadas con `es_blog`. Eso ponia la misma pieza en dos
-- secciones, que es justo lo que la regla nueva prohibe.
--
-- Ahora la seccion la decide `content_type`, y una pieza solo puede tener uno:
--   /contenido  content_type IN ('articulo','programa','herramienta','audio')
--   /blog       content_type = 'blog'
--   /guia       tabla clinical_guides (intacta)
--
-- Con eso `es_blog` sobra y se retira: mantener una marca paralela al tipo es
-- exactamente como se cuela una pieza en dos secciones otra vez.
-- ============================================================================

-- El CHECK ataba es_blog a content_type='articulo'; hay que soltarlo ANTES de
-- reasignar el tipo, o el UPDATE de abajo choca contra el.
ALTER TABLE content_items
  DROP CONSTRAINT IF EXISTS content_items_es_blog_is_free_article_check;

-- Las piezas escritas para el blog pasan a ser del tipo 'blog'.
UPDATE content_items
   SET content_type = 'blog'
 WHERE es_blog = true;

-- Un post de blog puede cerrar sus comentarios (frontmatter admite_comentarios).
-- El default es true porque el blog nace conversacional; en el resto de tipos la
-- columna existe pero nadie la mira: la caja de comentarios solo vive en /blog.
ALTER TABLE content_items
  ADD COLUMN IF NOT EXISTS admite_comentarios boolean NOT NULL DEFAULT true;

-- La vista cambia de columnas (se va es_blog, entra admite_comentarios). Tiene
-- que ser DROP + CREATE: CREATE OR REPLACE VIEW sabe agregar columnas al final,
-- no quitarlas ni reordenarlas.
DROP VIEW IF EXISTS content_items_meta;
CREATE VIEW content_items_meta AS
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
    admite_comentarios
  FROM content_items;

ALTER TABLE content_items DROP COLUMN IF EXISTS es_blog;

-- Listados: /blog ordena por fecha dentro de su tipo; /contenido excluye 'blog'.
DROP INDEX IF EXISTS content_items_blog_idx;
CREATE INDEX IF NOT EXISTS content_items_seccion_idx
  ON content_items (content_type, status, published_at DESC);
