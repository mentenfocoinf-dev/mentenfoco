-- ============================================================================
-- BACKUP DE REVERSIÓN — Sprint clinical_guides RLS + security_invoker
-- Generado el 2026-08-13 a partir del catálogo real, no de memoria.
--
-- ESTADO CAPTURADO ANTES DE LA MIGRACIÓN (29 criterios confirmados uno a uno):
--
--   public.clinical_guides
--     relrowsecurity      = FALSE
--     relforcerowsecurity = FALSE
--     reloptions          = NULL
--     owner               = postgres
--     políticas           = 1        <-- YA EXISTÍA. NO se modifica.
--     filas               = 20       (15 free + 5 esencial)
--     huella de datos     = 676fd831bd27ab20cf1a4656d943a253
--     triggers            = 0
--     FK salientes        = 0    ·   FK entrantes = 0
--     índices             = 2    ·   funciones que la citan = 0
--     Realtime            = 0
--     ACL = postgres=arwdDxtm/postgres, anon=rxtm/postgres,
--           authenticated=rm/postgres, service_role=arwdDxtm/postgres
--           -> efectiva: anon r--- · authenticated r---  (solo SELECT)
--
--   LA POLÍTICA EXISTENTE, TRANSCRITA DEL CATÁLOGO:
--     "Guides readable by plan level"  [SELECT]  roles {public}
--       USING ( (plan_rank(min_plan) = 0)
--               OR (get_my_plan_rank() >= plan_rank(min_plan))
--               OR (get_my_role() = ANY (ARRAY['admin'::user_role,
--                                              'therapist'::user_role])) )
--
--     LA MIGRACIÓN NO LA TOCA. Por eso este backup tampoco la recrea: si
--     intentase restaurarla, la borraría y la volvería a crear sin necesidad,
--     con riesgo de introducir una diferencia. Se deja exactamente donde está.
--
--   public.clinical_guides_meta
--     owner               = postgres (bypassrls = true)
--     reloptions          = NULL     -> security_invoker SIN DEFINIR
--     security_barrier    = no
--     ACL = postgres=arwdDxtm/postgres, anon=rxtm/postgres,
--           authenticated=rDxtm/postgres, service_role=arwdDxtm/postgres
--     definición: proyección de 11 de 14 columnas, SIN WHERE.
--       SELECT id, categoria, etiquetas, titulo, "descripcionBreve",
--              "tiempoLectura", "imageName", es_premium, min_plan,
--              visible_en_plan_gratis, theme_key
--         FROM clinical_guides;
--     Oculta: fundamentoClinico, ejercicioPractico, contenidoCompleto.
--     LA MIGRACIÓN NO REDEFINE LA VISTA: solo cambia una reloption.
--
--   Huellas globales del baseline:
--     ACL ........ c9a0182c86c1912385ee672d54f8c6c3
--     FK ......... cfb706920529fb9470ccbbf757a6537c
--     índices .... 6da61f8c851e3cf908ed5e2cb2d0e19a
--     triggers ... 3ca1288a327c51ad66d698009c86eb79
--     funciones .. e5e288e79a4b6f5b9364d7ffe902b7e1
--     vistas ..... 61114ef947d954eee83fcce7986cbd0a
--     estado RLS . 6940f4195bf710d841c50cd7da9b4d75
--     políticas .. 8757768ba08f2e4f59b47f0ae694b393
--
--   Estado global: 37 tablas · RLS 24/37 · FORCE 0/37 · 83 políticas
--
-- La migración NO toca ACL, triggers, funciones, FK, índices, datos ni la
-- definición de la vista, así que este backup no necesita restaurarlos.
-- ============================================================================

BEGIN;

-- 1. Devolver la vista a su estado exacto: reloptions = NULL.
--    RESET quita la opción por completo. NO se usa SET security_invoker = false,
--    que dejaría reloptions = {security_invoker=false}: un estado distinto del
--    capturado, aunque el efecto observable fuese el mismo.
ALTER VIEW public.clinical_guides_meta RESET (security_invoker);

-- 2. Desactivar RLS (el estado capturado era FALSE).
ALTER TABLE public.clinical_guides DISABLE ROW LEVEL SECURITY;

-- 3. NO se toca la política "Guides readable by plan level": la migración no la
--    modificó, así que sigue siendo la del baseline. Debe seguir habiendo
--    exactamente 1 política sobre clinical_guides después del rollback.

COMMIT;

-- ============================================================================
-- Comprobación posterior al rollback: debe devolver f, f, (NULL), 1, 20,
-- reloptions de la vista (NULL) y la huella de datos 676fd831bd27ab20cf1a4656d943a253
-- ============================================================================
-- SELECT relrowsecurity, relforcerowsecurity, reloptions FROM pg_class
--   WHERE oid = 'public.clinical_guides'::regclass;
-- SELECT count(*) FROM pg_policies
--   WHERE schemaname = 'public' AND tablename = 'clinical_guides';
-- SELECT reloptions FROM pg_class
--   WHERE oid = 'public.clinical_guides_meta'::regclass;
-- SELECT count(*) FROM public.clinical_guides;
-- ============================================================================
