-- ============================================================================
-- BACKUP DE REVERSION · Grupo 4 — RLS en crm_leads, public_test_submissions
--                                 y blog_comments
-- Fecha: 13 de agosto de 2026
--
-- Revierte la migracion `20260813_grupo4_rls.sql`, que activa RLS en TRES
-- tablas y crea NUEVE politicas.
--
-- `content_items` queda EXPRESAMENTE FUERA de este sprint y no aparece aqui.
--
-- ── Estado capturado del catalogo ANTES de la migracion ─────────────────────
--
-- Leido de `pg_class`, `pg_policies` y `pg_trigger`, no transcrito.
--
--   crm_leads                 relrowsecurity=false  relforcerowsecurity=false  owner=postgres
--     relacl = {postgres=arwdDxtm/postgres, anon=am/postgres,
--               authenticated=arwm/postgres, service_role=arwdDxtm/postgres}
--     filas = 0
--     politicas (2), que esta migracion NO toca:
--       [ALL]    Admins manage leads     PERMISSIVE TO authenticated
--           USING  (get_my_role() = 'admin'::user_role)
--       [INSERT] Anyone can create a lead  PERMISSIVE TO public
--           CHECK  true
--     triggers: (ninguno)
--
--   public_test_submissions   relrowsecurity=false  relforcerowsecurity=false  owner=postgres
--     relacl = {postgres=arwdDxtm/postgres, anon=awxtm/postgres,
--               authenticated=arwm/postgres, service_role=arwdDxtm/postgres}
--     filas = 5
--     politicas: (ninguna)
--     trigger: trg_submission_append_only BEFORE UPDATE
--       -> enforce_submission_append_only  invoker  md5=916f09d33080c06810547305b98809cc
--
--   blog_comments             relrowsecurity=false  relforcerowsecurity=false  owner=postgres
--     relacl = {postgres=arwdDxtm/postgres, anon=arwxtm/postgres,
--               authenticated=arwm/postgres, service_role=arwdDxtm/postgres}
--     filas = 2  (1 aprobado, 1 pendiente, ambos en el post 5f026a5f)
--     politicas: (ninguna)
--     trigger: trg_blog_comment_moderation BEFORE INSERT OR UPDATE
--       -> enforce_blog_comment_moderation  DEFINER  md5=bad3e3dd967a2cbb191d3660e86ba805
--
-- ── Huellas del esquema en el momento del backup ────────────────────────────
--
--   ACL de las 37 tablas .. 64cdb69b1241ea34ac996556da08dc19
--   41 triggers ........... 3d2e64ad54494bf5325eb7abb2e204c2
--   62 foreign keys ....... b9087924187f648a75b1677f7e8cd3ea
--   273 funciones ......... 6d9ef54e15e81e6708773bdf03daff69
--   56 politicas .......... 6fc3bfefd9cec7f40b5df6ec1742a662
--   indices ............... 77e5888324be70b084c854e06cc6c645
--   estado RLS ............ e799fcf8331e574b492e02c73aa378bd   (16 de 37)
--
-- ── Advertencia sobre revertir ──────────────────────────────────────────────
--
-- Apagar RLS aqui reabre dos fugas medidas:
--
--   * `crm_leads` vuelve a quedar abierta a **cualquier usuario con sesion**:
--     un paciente cualquiera podia leer los leads con nombre, correo y
--     telefono, modificarlos y crearlos. `anon` no: la ACL ya le niega SELECT.
--   * `blog_comments` vuelve a exponer los comentarios **no aprobados** a
--     visitantes sin sesion: `anon` leia los 2, incluido el pendiente.
--
-- No toca ACL, triggers, FK, funciones, indices ni datos. No toca ninguna otra
-- tabla: las 16 con RLS anteriores lo conservan, de modo que revertir deja el
-- conteo global en 16 de 37 y las politicas en 56.
--
-- ── Idempotencia ────────────────────────────────────────────────────────────
--
-- `DROP POLICY IF EXISTS` y `DISABLE ROW LEVEL SECURITY` no fallan si el
-- objeto ya esta en ese estado. Ejecutable las veces que haga falta.
-- ============================================================================

-- ─── Reversion ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Anyone submits a public test"   ON public.public_test_submissions;
DROP POLICY IF EXISTS "Submitters read their own id"   ON public.public_test_submissions;
DROP POLICY IF EXISTS "Admins read all submissions"    ON public.public_test_submissions;
DROP POLICY IF EXISTS "Submitters attach their email"  ON public.public_test_submissions;

DROP POLICY IF EXISTS "Anyone reads approved comments" ON public.blog_comments;
DROP POLICY IF EXISTS "Authors read their own comments" ON public.blog_comments;
DROP POLICY IF EXISTS "Moderators read the queue"      ON public.blog_comments;
DROP POLICY IF EXISTS "Authenticated users comment"    ON public.blog_comments;
DROP POLICY IF EXISTS "Moderators update comments"     ON public.blog_comments;

ALTER TABLE public.crm_leads               DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_test_submissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_comments           DISABLE ROW LEVEL SECURITY;

-- ─── Comprobacion posterior a la reversion ──────────────────────────────────
--
-- SELECT relname, relrowsecurity FROM pg_class
--  WHERE oid IN ('public.crm_leads'::regclass,
--                'public.public_test_submissions'::regclass,
--                'public.blog_comments'::regclass);        -> las tres false
--
-- SELECT tablename, count(*) FROM pg_policies WHERE schemaname='public'
--   AND tablename IN ('crm_leads','public_test_submissions','blog_comments')
--  GROUP BY tablename;   -> crm_leads 2 · las otras dos, sin filas
--
-- SELECT count(*) FROM pg_class
--  WHERE relnamespace='public'::regnamespace AND relkind='r' AND relrowsecurity;  -> 16
--
-- SELECT count(*) FROM pg_policies WHERE schemaname='public';  -> 56
