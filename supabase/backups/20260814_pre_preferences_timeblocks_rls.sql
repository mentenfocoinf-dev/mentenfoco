-- ============================================================================
-- BACKUP previo a 20260814_preferences_timeblocks_rls.sql
--
-- Estado de public.user_preferences y public.therapist_time_blocks el 14 de
-- agosto de 2026, ANTES de activar RLS. Generado leyendo el catálogo
-- (pg_class, pg_policies, information_schema.column_privileges, pg_trigger),
-- no de memoria.
--
-- ESTADO CAPTURADO — los 47 criterios reconfirmados en la Fase 1:
--
--                               user_preferences        therapist_time_blocks
--   relrowsecurity .........    false                   false
--   relforcerowsecurity ....    false                   false
--   reloptions .............    (NULL)                  (NULL)
--   owner ..................    postgres                postgres
--   filas ..................    0                       0
--   columnas ...............    9                       7
--   CHECK propios ..........    1                       3
--   políticas ..............    0                       0
--   triggers propios .......    1                       1
--   FK salientes ...........    1                       1
--   FK entrantes ...........    0                       0
--   índices ................    1                       2
--   vistas dependientes ....    0                       0
--   Realtime / Broadcast ...    0                       0
--   funciones que la citan .    3                       2
--   huella de datos ........    (VACÍA)                 (VACÍA)
--
--   ACL literal:
--     user_preferences
--       postgres=arwdDxtm/postgres, service_role=arwdDxtm/postgres, authenticated=aw/postgres
--     therapist_time_blocks
--       postgres=arwdDxtm/postgres, service_role=arwdDxtm/postgres, authenticated=ad/postgres
--
--   Verificado con has_table_privilege, los ocho privilegios:
--     user_preferences        anon --------   authenticated -aw-----
--     therapist_time_blocks   anon --------   authenticated -a-d----
--     service_role y postgres  rawdDxtm en las dos
--
--   grants por columna:
--     user_preferences       authenticated  INSERT x9 · UPDATE x9 · SELECT x1 (profile_id)   = 19
--     therapist_time_blocks  authenticated  INSERT x7 ·             SELECT x2 (id, therapist_id) = 9
--     anon                   0 en ambas
--
--   Triggers, que NO se tocan:
--     trg_user_preferences_ownership  BEFORE INSERT OR UPDATE
--     trg_time_block_ownership        BEFORE INSERT OR UPDATE OR DELETE
--
--   Globales:
--     RLS 31/37 · FORCE 0/37 · políticas 92
--     huella POL ....... 345c6ca68f28c4f7dcaeca378e325228
--     huella TRIGGERS .. 3ca1288a327c51ad66d698009c86eb79
--     huella FUNCTIONS . e5e288e79a4b6f5b9364d7ffe902b7e1
--     huella FK ........ cfb706920529fb9470ccbbf757a6537c
--     huella INDEXES ... 6da61f8c851e3cf908ed5e2cb2d0e19a
--     huella VIEWS ..... b23db2e27087288f50410d711cbf8de4
--
-- QUÉ HACE ESTE ROLLBACK: elimina las 6 políticas creadas y desactiva RLS en
-- las dos tablas. Nada más.
--
-- QUÉ NO TOCA, PORQUE LA MIGRACIÓN TAMPOCO LO TOCÓ: la ACL de tabla —este
-- sprint NO hace ningún REVOKE ni GRANT—, los grants por columna, los dos
-- triggers de propiedad, las 5 funciones SECURITY DEFINER, las FK, los índices,
-- los CHECK, los datos (0 filas en ambas) y cualquier otra tabla.
--
-- Por eso este rollback NO lleva ningún GRANT: la ACL nunca se movió, y
-- reponerla sería introducir un cambio que la migración no hizo. La comparación
-- de `relacl` tras el rollback debe salir IDÉNTICA, dígito a dígito, sin el
-- matiz de reordenación que apareció en test_scores y en content_revisions
-- —allí sí hubo REVOKE y GRANT; aquí no hay ninguno—.
--
-- No se usa `NO FORCE`: FORCE nunca se activó.
-- ============================================================================

BEGIN;

-- ── user_preferences ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users read their own preferences"   ON public.user_preferences;
DROP POLICY IF EXISTS "Users create their own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users update their own preferences" ON public.user_preferences;

ALTER TABLE public.user_preferences DISABLE ROW LEVEL SECURITY;

-- ── therapist_time_blocks ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Therapists read their own time blocks"   ON public.therapist_time_blocks;
DROP POLICY IF EXISTS "Therapists create their own time blocks" ON public.therapist_time_blocks;
DROP POLICY IF EXISTS "Therapists delete their own time blocks" ON public.therapist_time_blocks;

ALTER TABLE public.therapist_time_blocks DISABLE ROW LEVEL SECURITY;

COMMIT;

-- ============================================================================
-- REGLA 1 — el catálogo demuestra el estado restaurado
-- ============================================================================
SELECT
  (SELECT relrowsecurity FROM pg_class
     WHERE oid = 'public.user_preferences'::regclass)                    AS up_rls,
  (SELECT relforcerowsecurity FROM pg_class
     WHERE oid = 'public.user_preferences'::regclass)                    AS up_force,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'user_preferences')     AS up_politicas,
  (SELECT array_to_string(relacl, ', ') FROM pg_class
     WHERE oid = 'public.user_preferences'::regclass)                    AS up_acl,
  (SELECT count(*) FROM information_schema.column_privileges
    WHERE table_schema = 'public' AND table_name = 'user_preferences'
      AND grantee = 'authenticated')                                     AS up_grants_col,
  (SELECT count(*) FROM public.user_preferences)                         AS up_filas,
  (SELECT relrowsecurity FROM pg_class
     WHERE oid = 'public.therapist_time_blocks'::regclass)               AS tb_rls,
  (SELECT relforcerowsecurity FROM pg_class
     WHERE oid = 'public.therapist_time_blocks'::regclass)               AS tb_force,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'therapist_time_blocks') AS tb_politicas,
  (SELECT array_to_string(relacl, ', ') FROM pg_class
     WHERE oid = 'public.therapist_time_blocks'::regclass)               AS tb_acl,
  (SELECT count(*) FROM information_schema.column_privileges
    WHERE table_schema = 'public' AND table_name = 'therapist_time_blocks'
      AND grantee = 'authenticated')                                     AS tb_grants_col,
  (SELECT count(*) FROM public.therapist_time_blocks)                    AS tb_filas,
  (SELECT count(*) FROM pg_trigger
     WHERE tgrelid IN ('public.user_preferences'::regclass,
                       'public.therapist_time_blocks'::regclass)
       AND NOT tgisinternal)                                             AS triggers,
  (SELECT count(*) FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity)  AS tablas_con_rls,
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'public')         AS politicas_public;
