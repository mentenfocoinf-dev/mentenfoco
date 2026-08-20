-- ============================================================================
-- BACKUP DE REVERSIÓN — Sprint Content Items RLS
-- Generado el 2026-08-13 a partir del catálogo real, no de memoria.
--
-- ESTADO CAPTURADO ANTES DE LA MIGRACIÓN (consultado en pg_class / pg_policies):
--
--   public.content_items
--     relrowsecurity      = FALSE
--     relforcerowsecurity = FALSE
--     políticas           = 0   (ninguna, la lista vino vacía)
--
--   public.content_items_meta
--     reloptions          = NULL   -> security_invoker SIN DEFINIR
--     owner               = postgres
--     ACL                 = postgres=arwdDxtm, anon=rxtm, authenticated=rDxtm,
--                           service_role=arwdDxtm
--
--   Huellas del baseline (misma fórmula que usa la comprobación de rollback):
--     estado RLS ... b5ac7b239424c331298f34c2b9a8ea93
--     políticas .... f927f6516c4795269b69f39d977d7be5
--     vistas ....... d8003754f6784e97b0f41d72601f00f7
--     ACL .......... c310d7933a48030ef6ee4506a495cdb2
--
-- Como la tabla no tenía NINGUNA política, el rollback no restaura nada:
-- solo elimina lo que la migración crea. Esto no es una simplificación —
-- es lo que dice el catálogo.
--
-- La migración NO toca ACL, ni triggers, ni funciones, ni FK, ni índices,
-- ni datos, así que este backup no necesita restaurarlos.
--
-- Definición de la vista en el momento del backup (proyección de 15 columnas,
-- sin WHERE). La migración NO la redefine, solo cambia una reloption, así que
-- se deja aquí como referencia y no como sentencia a ejecutar:
--
--   SELECT id, content_type, audio_kind, categoria, titulo, slug,
--          resumen_breve, cover_image, tiempo_lectura, min_plan, tags,
--          status, published_at, admite_comentarios, theme_key
--     FROM content_items;
-- ============================================================================

BEGIN;

-- 1. Devolver la vista a su estado exacto: reloptions = NULL.
--    RESET quita la opción por completo; no la pone en false, que sería
--    un estado distinto del capturado.
ALTER VIEW public.content_items_meta RESET (security_invoker);

-- 2. Desactivar RLS (el estado capturado era FALSE).
ALTER TABLE public.content_items DISABLE ROW LEVEL SECURITY;

-- 3. Eliminar las cinco políticas que crea la migración.
--    El estado capturado tenía 0 políticas: no se restaura ninguna.
DROP POLICY IF EXISTS "Public reads published content within plan" ON public.content_items;
DROP POLICY IF EXISTS "Authors read their own content"             ON public.content_items;
DROP POLICY IF EXISTS "Admins read all content"                    ON public.content_items;
DROP POLICY IF EXISTS "Authors create their own content"           ON public.content_items;
DROP POLICY IF EXISTS "Authors and admins update content"          ON public.content_items;

COMMIT;

-- ============================================================================
-- Comprobación posterior al rollback: debe devolver f, f, 0, (NULL)
-- ============================================================================
-- SELECT relrowsecurity, relforcerowsecurity FROM pg_class
--   WHERE oid = 'public.content_items'::regclass;
-- SELECT count(*) FROM pg_policies
--   WHERE schemaname = 'public' AND tablename = 'content_items';
-- SELECT reloptions FROM pg_class
--   WHERE oid = 'public.content_items_meta'::regclass;
-- ============================================================================
