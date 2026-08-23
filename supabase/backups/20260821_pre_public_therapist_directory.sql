-- ============================================================================
-- BACKUP / ROLLBACK previo a 20260821_public_therapist_directory.sql (Item 2)
--
-- ESTADO CAPTURADO (baseline vivo, post-item-1, 21-ago-2026):
--   vista public_therapist_directory .. NO existe
--   therapist_profiles SELECT policy ... "Anyone reads therapist profiles"
--                                        PERMISSIVE, roles {anon,authenticated}, USING(true)
--   anon SELECT (base) ................. true
--   tablas 39 · vistas 2 · políticas 102
--   huella POL ........................ aec90dd51b042110bb40f920ead544b7
--   huella ACL global ................. 05eef021934dd861e1d2f64403989360
--
-- El rollback restaura EXACTAMENTE ese estado: elimina la vista, quita la
-- política nueva, recrea la política original y devuelve el grant a anon.
-- ============================================================================

BEGIN;

DROP VIEW IF EXISTS public.public_therapist_directory;

DROP POLICY IF EXISTS "Authenticated reads therapist profiles" ON public.therapist_profiles;

CREATE POLICY "Anyone reads therapist profiles"
  ON public.therapist_profiles FOR SELECT TO anon, authenticated
  USING (true);

GRANT SELECT ON TABLE public.therapist_profiles TO anon;

COMMIT;

-- ============================================================================
-- REGLA 1 — el catálogo demuestra el estado restaurado (= baseline)
-- ============================================================================
SELECT
  (SELECT roles::text FROM pg_policies WHERE schemaname='public' AND tablename='therapist_profiles' AND cmd='SELECT') AS tp_select_roles,
  (SELECT has_table_privilege('anon','public.therapist_profiles','SELECT')) AS anon_base_select,
  (SELECT EXISTS(SELECT 1 FROM information_schema.views WHERE table_schema='public' AND table_name='public_therapist_directory')) AS vista_existe,
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='v') AS vistas,
  (SELECT count(*) FROM pg_policies WHERE schemaname='public') AS politicas_total,
  (SELECT md5(string_agg(schemaname||tablename||policyname||cmd||coalesce(qual,'')||coalesce(with_check,''),'|' ORDER BY tablename,policyname)) FROM pg_policies WHERE schemaname='public') AS huella_pol,
  (SELECT md5(string_agg(c.relname||':'||coalesce(array_to_string(c.relacl,','),'-'),'|' ORDER BY c.relname)) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r') AS huella_acl_global;
