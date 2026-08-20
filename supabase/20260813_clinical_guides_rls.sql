-- ============================================================================
-- Sprint clinical_guides RLS + security_invoker
--
-- DOS SENTENCIAS. CERO POLÍTICAS NUEVAS.
--
-- Es el sprint más corto del plan de RLS, y por una razón concreta: la tabla
-- YA trae la política correcta desde el Grupo 0. Lo único que faltaba era
-- encenderla y que la vista dejara de esquivarla.
--
-- LA POLÍTICA QUE YA EXISTE Y QUE ESTE SPRINT **NO TOCA**:
--
--   "Guides readable by plan level"  [SELECT]  roles {public}
--     USING ( plan_rank(min_plan) = 0
--             OR get_my_plan_rank() >= plan_rank(min_plan)
--             OR get_my_role() = ANY (ARRAY['admin'::user_role,
--                                           'therapist'::user_role]) )
--
--   Cubre los tres casos sin ayuda: las guías gratuitas son públicas
--   (plan_rank = 0), el corte por plan lo hace get_my_plan_rank(), y la rama de
--   rol clínico evita la regresión que en content_items hubo que añadir a mano.
--   El rol es {public}, no authenticated: es uno de los dos flujos públicos que
--   el Grupo 0 dejó fuera del acotamiento a propósito.
--
-- QUÉ CIERRA — medido con RLS apagado, así que no es atribuible a RLS:
--
--   anon / paciente free / cualquiera .... 20 guías por tabla y por vista
--     ... de las cuales de pago .......... 5, con contenidoCompleto entero
--         (4.523 caracteres de media)
--
--   El muro de pago no existía a nivel de datos: lo aplicaba solo el filtro
--   .in("min_plan", allowedPlans(plan)) de los cuatro consumidores.
--
-- POR QUÉ LAS DOS SENTENCIAS VAN JUNTAS:
--
--   clinical_guides_meta pertenece a postgres (bypassrls) y no tiene
--   security_invoker. Medido en el diagnóstico, con RLS activo y la vista
--   intacta:
--       anon, tabla .... 15   ✔
--       anon, vista .... 20   ✘  la vista esquiva RLS
--   Protección aparente. Y el ALTER VIEW por sí solo, sin RLS, no cambia nada.
--   Son inseparables, igual que content_items y su vista.
--
--   Matiz frente a content_items: esta vista NO proyecta las columnas de
--   contenido (fundamentoClinico, ejercicioPractico, contenidoCompleto), así
--   que la fuga por ese canal sería de metadatos. Menos grave, igual de
--   engañoso.
--
-- QUÉ NO TOCA:
-- la política existente, la definición de la vista, ACL, triggers, funciones,
-- RPC, FK, índices, datos, frontend, Realtime ni ninguna otra tabla.
-- FORCE no se activa.
--
-- Backup: supabase/backups/20260813_pre_clinical_guides_rls.sql
-- Diagnóstico: contexto-proyecto/auditorias-tecnicas/Diagnostico_RLS_clinical_guides_2026-08-13.md
--
-- Idempotente: ENABLE ROW LEVEL SECURITY y ALTER VIEW ... SET son ambos
-- idempotentes por definición. No hay CREATE POLICY, así que no hay 42710
-- posible.
-- ============================================================================

BEGIN;

-- 1. Encender la política que ya estaba escrita.
ALTER TABLE public.clinical_guides ENABLE ROW LEVEL SECURITY;

-- 2. Que la vista deje de ejecutarse como postgres y pase a evaluarse con los
--    permisos de quien consulta, para que las políticas de arriba también la
--    gobiernen. Sin esto, los tres consumidores de la vista —incluida la
--    portada— seguirían viéndolo todo.
ALTER VIEW public.clinical_guides_meta SET (security_invoker = true);

COMMIT;

-- ============================================================================
-- REGLA 1 — el catálogo demuestra el estado final
-- ============================================================================
SELECT
  (SELECT relrowsecurity FROM pg_class
     WHERE oid = 'public.clinical_guides'::regclass)                     AS rls_activo,
  (SELECT relforcerowsecurity FROM pg_class
     WHERE oid = 'public.clinical_guides'::regclass)                     AS force_activo,
  (SELECT coalesce(array_to_string(reloptions, ','), '(NULL)') FROM pg_class
     WHERE oid = 'public.clinical_guides'::regclass)                     AS tabla_reloptions,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'clinical_guides')      AS politicas,
  (SELECT policyname FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'clinical_guides')      AS politica_nombre,
  (SELECT md5(qual) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'clinical_guides')      AS politica_huella,
  (SELECT coalesce(array_to_string(reloptions, ','), '(NULL)') FROM pg_class
     WHERE oid = 'public.clinical_guides_meta'::regclass)                AS vista_reloptions,
  (SELECT md5(pg_get_viewdef('public.clinical_guides_meta'::regclass, true)))
                                                                         AS vista_definicion,
  (SELECT count(*) FROM public.clinical_guides)                          AS filas,
  (SELECT count(*) FROM pg_trigger
     WHERE tgrelid = 'public.clinical_guides'::regclass
       AND NOT tgisinternal)                                             AS triggers,
  (SELECT count(*) FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity) AS tablas_con_rls,
  (SELECT count(*) FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND c.relforcerowsecurity)                                         AS tablas_con_force,
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'public')         AS politicas_public;
