-- ============================================================================
-- 'blog' como cuarto... quinto tipo de contenido.
--
-- Va SOLO en esta migracion, sin nada mas: Postgres no deja usar un valor de
-- enum recien agregado dentro de la misma transaccion que lo agrego. La
-- migracion que reasigna las piezas y limpia `es_blog` es la 20260729b.
--
-- Regla de producto (29-jul): Guias, Contenido y Blog son tres secciones
-- distintas y una pieza vive en una sola. `content_type` es lo que decide en
-- cual: por eso el blog deja de ser una marca sobre un articulo y pasa a ser un
-- tipo propio.
-- ============================================================================

ALTER TYPE content_type ADD VALUE IF NOT EXISTS 'blog';
