-- ============================================================================
-- Sprint Content Items RLS — Escenario B
--
-- Activa RLS sobre public.content_items con cinco políticas y hace que la
-- vista public.content_items_meta las respete.
--
-- POR QUÉ VAN JUNTOS EN LA MISMA MIGRACIÓN:
-- content_items_meta pertenece a postgres, que tiene bypassrls. Sin
-- security_invoker la vista se ejecuta con los permisos de su dueño y esquiva
-- RLS por completo: medido, anon seguía leyendo las 26 piezas por la vista y 0
-- por la tabla. Aplicar las políticas sin el ALTER VIEW daría una protección
-- aparente; aplicar el ALTER VIEW sin políticas no cambiaría nada.
--
-- QUÉ CIERRA:
-- hoy anon, sin sesión, lee por la tabla el body_md completo de las 8 piezas
-- premium. El muro de pago solo lo aplica el frontend al construir la consulta.
--
-- QUÉ NO TOCA:
-- ACL, triggers, funciones, RPC, FK, índices, datos, frontend ni ninguna otra
-- tabla. El trigger trg_content_authorization sigue siendo quien aplica la
-- regla editorial; RLS solo añade el filtro de filas que no existía.
--
-- Backup de reversión: supabase/backups/20260813_pre_content_items_rls.sql
-- Diagnóstico: contexto-proyecto/auditorias-tecnicas/Diagnostico_RLS_content_items_2026-08-12.md
--
-- Idempotente: cada política se elimina antes de crearse; ENABLE y ALTER VIEW
-- SET son idempotentes por definición.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Lectura pública de lo publicado, acotada por plan.
--
-- La rama de rol clínico replica getViewerPlan() (guidesService.ts:92-110), que
-- trata a admin y therapist como premium POR ROL. get_my_plan_rank() solo mira
-- plan_type, y ambos lo tienen en 'free': sin esta rama el equipo clínico
-- pasaría de ver 26 piezas a ver 10. Es paridad con el comportamiento actual,
-- no una decisión nueva de negocio. Si algún día cambia, hay que cambiarlo en
-- los dos sitios a la vez.
--
-- El blog no necesita política propia: el CHECK content_items_blog_es_publico
-- garantiza que toda pieza de blog tiene min_plan='free', y plan_rank('free')=0,
-- así que esta política siempre lo deja pasar.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public reads published content within plan" ON public.content_items;
CREATE POLICY "Public reads published content within plan"
  ON public.content_items
  AS PERMISSIVE FOR SELECT
  TO anon, authenticated
  USING (
    status = 'publicado'
    AND (
      public.plan_rank(min_plan) <= public.get_my_plan_rank()
      OR public.get_my_role() = ANY (ARRAY['admin'::user_role, 'therapist'::user_role])
    )
  );

-- ----------------------------------------------------------------------------
-- 2. Cada autor ve lo suyo, esté publicado o no.
--    Consumidor: contentService.ts:262 listMyContent.
--    También es la política que permite el RETURNING de createContentDraft:324.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authors read their own content" ON public.content_items;
CREATE POLICY "Authors read their own content"
  ON public.content_items
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (auth.uid() = author_id);

-- ----------------------------------------------------------------------------
-- 3. El administrador ve todo el catálogo, en cualquier estado.
--    Consumidores: contentService.ts:353 listReviewQueue, :367 listAllContent.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins read all content" ON public.content_items;
CREATE POLICY "Admins read all content"
  ON public.content_items
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (public.get_my_role() = 'admin');

-- ----------------------------------------------------------------------------
-- 4. Alta solo a nombre propio.
--    Consumidor: contentService.ts:324 createContentDraft (INSERT + .select()).
--    Quién puede crear contenido lo sigue decidiendo el trigger
--    enforce_content_authorization (CONTENT_AUTHOR_ROLE para un paciente).
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authors create their own content" ON public.content_items;
CREATE POLICY "Authors create their own content"
  ON public.content_items
  AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

-- ----------------------------------------------------------------------------
-- 5. Edición: el autor sobre lo suyo, el administrador sobre todo.
--    Consumidores: :336 updateContentDraft, :343 submitForReview,
--    :379 approveContent, :396 requestContentChanges, :423 publishContent,
--    :443 archiveContent.
--
--    WITH CHECK (true) es deliberado. Qué transición de estado es válida ya lo
--    gobiernan enforce_content_authorization y los CHECK de la tabla;
--    duplicar esa lógica aquí crearía una segunda fuente de verdad que se
--    desincronizaría. La política decide SOBRE QUÉ FILA se puede escribir,
--    el trigger decide QUÉ ESCRITURA es válida.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authors and admins update content" ON public.content_items;
CREATE POLICY "Authors and admins update content"
  ON public.content_items
  AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_id OR public.get_my_role() = 'admin')
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- Sin política de DELETE, deliberadamente: authenticated no tiene 'd' en la ACL
-- y el flujo editorial archiva en vez de borrar. Sin política, el DELETE queda
-- cerrado, que es lo correcto.
-- ----------------------------------------------------------------------------

ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- La vista deja de ejecutarse como postgres (bypassrls) y pasa a evaluarse con
-- los permisos de quien consulta, de modo que las políticas de arriba también
-- la gobiernan. Sin esto, los 4 consumidores de la vista seguirían viéndolo todo.
-- ----------------------------------------------------------------------------
ALTER VIEW public.content_items_meta SET (security_invoker = true);

COMMIT;

-- ============================================================================
-- REGLA 1 — el catálogo demuestra el estado final
-- ============================================================================
SELECT
  (SELECT relrowsecurity FROM pg_class
     WHERE oid = 'public.content_items'::regclass)                       AS rls_activo,
  (SELECT relforcerowsecurity FROM pg_class
     WHERE oid = 'public.content_items'::regclass)                       AS force_activo,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'content_items')        AS politicas,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'content_items'
       AND cmd = 'SELECT')                                               AS de_select,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'content_items'
       AND cmd = 'INSERT')                                               AS de_insert,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'content_items'
       AND cmd = 'UPDATE')                                               AS de_update,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'content_items'
       AND cmd = 'DELETE')                                               AS de_delete,
  (SELECT array_to_string(reloptions, ', ') FROM pg_class
     WHERE oid = 'public.content_items_meta'::regclass)                  AS vista_reloptions,
  (SELECT count(*) FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity) AS tablas_con_rls;
