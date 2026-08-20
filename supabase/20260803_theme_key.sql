-- ============================================================================
-- theme_key — eje temático interno del catálogo.
--
-- Tercer eje, ortogonal a los dos que ya existen:
--   categoria  -> dónde se encuentra navegando (eje público)
--   tags       -> con qué enfoque o mecanismo trabaja (eje de detalle)
--   theme_key  -> de qué trata en el fondo (eje interno, cruza secciones)
--
-- Enum y no texto libre por la misma razón que content_type y plan_type: con
-- texto libre, "Ansiedad", "ansiedad" y "ansiedad_panico" acaban siendo tres
-- temas distintos. Ya ocurrió con los tags (42 en guías, 65 en contenido, 2
-- compartidos). El enum hace que un valor inventado falle en la base.
--
-- Migración NO destructiva:
--   · columnas NULLABLE, sin valor por defecto y sin backfill;
--   · no se toca categoria ni tags;
--   · las vistas suman la columna AL FINAL (CREATE OR REPLACE VIEW no permite
--     reordenar ni renombrar columnas existentes).
--
-- La asignación de tema a cada pieza es una decisión editorial y clínica del
-- responsable del producto (ADR-007). Esta migración solo abre el sitio.
--
-- RLS: sin cambios. Es una columna más de un catálogo ya legible, no un dato
-- de terceros; el control de lectura sigue siendo el filtro por min_plan que
-- aplican contentService y guidesService.
-- ============================================================================

-- ── El vocabulario: 15 temas ────────────────────────────────────────────────
-- snake_case sin acentos, en español, igual que content_type y plan_type.
-- Añadir un valor después exige su propia migración (ALTER TYPE ADD VALUE no
-- puede usarse en la misma transacción en que se crea el valor).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'theme_key') THEN
    CREATE TYPE public.theme_key AS ENUM (
      'ansiedad_panico',
      'animo_depresion',
      'sueno_descanso',
      'estres_burnout',
      'autoestima_dialogo_interno',
      'regulacion_presencia',
      'enfoque_procrastinacion',
      'relaciones_vinculos',
      'duelo_perdida',
      'trauma',
      'crianza_infancia',
      'alimentacion',
      'memoria_envejecimiento',
      'neurodivergencia',
      'proceso_terapeutico'
    );
  END IF;
END
$$;

-- ── Las dos columnas ────────────────────────────────────────────────────────
-- El MISMO enum en ambas tablas es la razón entera del eje: es lo que permite
-- que una guía y una pieza de contenido se encuentren entre sí.
ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS theme_key public.theme_key;

ALTER TABLE public.clinical_guides
  ADD COLUMN IF NOT EXISTS theme_key public.theme_key;

COMMENT ON COLUMN public.content_items.theme_key IS
  'Tema editorial interno. Una pieza, un tema. NULL = sin clasificar todavía; el motor cae a categoria.';
COMMENT ON COLUMN public.clinical_guides.theme_key IS
  'Tema editorial interno. Mismo enum que content_items: es lo que permite cruzar secciones.';

-- El motor filtra por theme_key + min_plan en cada bloque de recomendaciones.
CREATE INDEX IF NOT EXISTS idx_content_items_theme_key
  ON public.content_items (theme_key) WHERE theme_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clinical_guides_theme_key
  ON public.clinical_guides (theme_key) WHERE theme_key IS NOT NULL;

-- ── Vistas ──────────────────────────────────────────────────────────────────
-- theme_key va AL FINAL en las dos. Cambiar el orden obligaría a DROP VIEW, y
-- eso rompería los GRANT y cualquier dependencia.
CREATE OR REPLACE VIEW public.content_items_meta AS
  SELECT id,
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
    admite_comentarios,
    theme_key
  FROM public.content_items;

CREATE OR REPLACE VIEW public.clinical_guides_meta AS
  SELECT id,
    categoria,
    etiquetas,
    titulo,
    "descripcionBreve",
    "tiempoLectura",
    "imageName",
    es_premium,
    min_plan,
    visible_en_plan_gratis,
    theme_key
  FROM public.clinical_guides;
