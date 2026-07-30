-- ============================================================================
-- El blog es publico por definicion.
--
-- /blog no filtra por plan: es la seccion abierta, sin sesion. Si una pieza de
-- blog pudiera tener min_plan de pago, el campo existiria sin efecto y alguien
-- creeria haberla restringido. Se cierra en la base para que no dependa de que
-- la UI se acuerde.
-- ============================================================================

UPDATE content_items SET min_plan = 'free' WHERE content_type = 'blog';

ALTER TABLE content_items
  DROP CONSTRAINT IF EXISTS content_items_blog_es_publico_check;
ALTER TABLE content_items
  ADD CONSTRAINT content_items_blog_es_publico_check
  CHECK (content_type <> 'blog' OR min_plan = 'free');
