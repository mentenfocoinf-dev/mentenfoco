-- ============================================================================
-- 1) Campos de SEO que ahora fija el ADMIN al publicar (no el terapeuta).
-- 2) `slug` pasa a ser opcional mientras la pieza está en borrador/revisión:
--    el terapeuta ya no lo escribe, lo define el admin antes de publicar.
-- 3) Rebalanceo de min_plan para que el set gratuito tenga al menos una pieza
--    de cada tipo (hoy no hay ningún programa en free).
--
-- Contexto de producto: se elimina el modelo de "mostrar todo con candado".
-- Ahora el usuario ve solo lo que su plan incluye, completo. min_plan sigue
-- siendo el campo que decide desde qué plan aparece cada pieza; lo que cambia
-- es que los listados filtran por él en vez de bloquear.
-- ============================================================================

ALTER TABLE content_items
  ADD COLUMN IF NOT EXISTS meta_title       text,
  ADD COLUMN IF NOT EXISTS meta_description text;

COMMENT ON COLUMN content_items.meta_title IS
  'Título para buscadores. Lo fija el admin al publicar; el terapeuta no lo ve.';
COMMENT ON COLUMN content_items.meta_description IS
  'Descripción para buscadores. La fija el admin al publicar; el terapeuta no la ve.';

-- El slug deja de ser obligatorio en la creación: el terapeuta escribe solo
-- contenido, y el admin define la URL antes de publicar.
ALTER TABLE content_items ALTER COLUMN slug DROP NOT NULL;

-- ...pero una pieza publicada SIN slug no tendría URL, así que eso sí se impide.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.content_items'::regclass
      AND conname = 'content_items_published_needs_slug_check'
  ) THEN
    ALTER TABLE content_items
      ADD CONSTRAINT content_items_published_needs_slug_check
      CHECK (status <> 'publicado' OR (slug IS NOT NULL AND btrim(slug) <> ''));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Rebalanceo del set gratuito.
--
-- Antes: los 3 programas exigían plan pago, así que un usuario Free se quedaba
-- literalmente sin ningún programa. Con el modelo nuevo (sin candados) eso
-- significa que ni siquiera vería que existen.
--
-- Se libera el programa de entrada (Calma / ansiedad), que es el más adecuado
-- como primer contacto. Los otros dos siguen en 'esencial'.
-- El reparto fino por tier se ajusta cuando llegue el contenido nuevo.
-- ---------------------------------------------------------------------------
UPDATE content_items SET min_plan = 'free' WHERE slug = 'programa-calma';
