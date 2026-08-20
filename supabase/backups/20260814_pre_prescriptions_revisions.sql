-- ============================================================================
-- BACKUP previo a 20260814_prescriptions_revisions.sql
--
-- Estado de public.clinical_prescriptions y public.content_revisions el 14 de
-- agosto de 2026, ANTES del REVOKE y de activar RLS. Generado leyendo el
-- catálogo (pg_class.relacl, has_table_privilege, pg_policies,
-- information_schema.column_privileges), no de memoria.
--
-- ESTADO CAPTURADO — los 49 criterios reconfirmados en la Fase 1:
--
--                               clinical_prescriptions      content_revisions
--   relrowsecurity .........    false                       false
--   relforcerowsecurity ....    false                       false
--   reloptions .............    (NULL)                      (NULL)
--   owner ..................    postgres                    postgres
--   filas ..................    14                          0
--   columnas ...............    4                           7
--   CHECK propios ..........    0                           0
--   políticas ..............    1                           0
--   triggers propios .......    0                           0
--   FK salientes ...........    0                           2
--   FK entrantes ...........    1                           0
--   índices ................    1                           2
--   vistas dependientes ....    0                           0
--   Realtime / Broadcast ...    0                           0
--   funciones que la citan .    0                           1 (solo en un comentario)
--   huella de datos ........    61a83e356d2451f972576cf0f9b2e2c9   (VACÍA)
--
--   ACL literal — IDÉNTICA en las dos tablas:
--     postgres=arwdDxtm/postgres, anon=m/postgres,
--     authenticated=arwm/postgres, service_role=arwdDxtm/postgres
--
--   Verificado con has_table_privilege, los ocho privilegios:
--     anon            -------m     (solo MAINTAIN)
--     authenticated   raw----m     SELECT + INSERT + UPDATE + MAINTAIN
--     service_role    rawdDxtm
--     postgres        rawdDxtm
--
--   grants por columna:
--     clinical_prescriptions  authenticated  SELECT/INSERT/UPDATE  x4 c/u  = 12
--     content_revisions       authenticated  SELECT/INSERT/UPDATE  x7 c/u  = 21
--     anon                    0 en ambas
--
--   La política existente de clinical_prescriptions, que la migración CONSERVA:
--     "Authenticated users read the prescription catalog"
--     SELECT · PERMISSIVE · TO authenticated · USING (true)
--     Creada por 20260812_grupo0_preparacion_politicas.sql
--
--   Globales:
--     RLS 29/37 · FORCE 0/37 · políticas 92
--     huella RLS ....... 7e14abca5e88bd6d1aade67391ceedab
--     huella POL ....... 345c6ca68f28c4f7dcaeca378e325228
--     huella ACL ....... 050454ff3acaefb57dadd0f0b6bc6c6a
--     huella TRIGGERS .. 3ca1288a327c51ad66d698009c86eb79
--     huella FUNCTIONS . e5e288e79a4b6f5b9364d7ffe902b7e1
--     huella FK ........ cfb706920529fb9470ccbbf757a6537c
--     huella INDEXES ... 6da61f8c851e3cf908ed5e2cb2d0e19a
--     huella VIEWS ..... b23db2e27087288f50410d711cbf8de4
--
-- QUÉ HACE ESTE ROLLBACK:
--   1. Desactiva RLS en las dos tablas.
--   2. Devuelve a `authenticated` INSERT y UPDATE sobre clinical_prescriptions.
--   3. Devuelve a `authenticated` SELECT, INSERT, UPDATE y MAINTAIN sobre
--      content_revisions, y a `anon` su MAINTAIN.
--
--   Los GRANT están escritos privilegio a privilegio a partir de la tabla de
--   arriba, no con un `ALL` que concedería de más: NINGUNO de los dos roles
--   tenía DELETE, TRUNCATE, REFERENCES ni TRIGGER en ninguna de las dos tablas.
--
-- QUÉ NO TOCA, PORQUE LA MIGRACIÓN TAMPOCO LO TOCÓ:
--   · La política del Grupo 0: la migración NO la elimina ni la modifica, así
--     que aquí no hay nada que recrear. Sigue siendo la misma fila de
--     pg_policies de principio a fin.
--   · El SELECT de `authenticated` sobre clinical_prescriptions: se conserva en
--     la migración, luego no se restaura aquí.
--   · Los privilegios de `postgres` y `service_role`.
--   · Propietario, columnas, defaults, FK, índices, triggers (0 en ambas),
--     funciones, vistas (0), Realtime (0) y datos.
--   · patient_prescriptions, content_items, profiles y cualquier otra tabla.
--
--   No se usa `NO FORCE`: FORCE nunca se activó.
-- ============================================================================

BEGIN;

-- ── 1. RLS vuelve a estar desactivado en las dos ────────────────────────────
ALTER TABLE public.clinical_prescriptions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_revisions      DISABLE ROW LEVEL SECURITY;

-- ── 2. clinical_prescriptions: authenticated recupera la escritura ──────────
--    SELECT y MAINTAIN no se tocan porque la migración no los revocó.
GRANT INSERT, UPDATE ON TABLE public.clinical_prescriptions TO authenticated;

-- ── 3. content_revisions: se repone la ACL exacta ───────────────────────────
--    authenticated tenía arwm = SELECT + INSERT + UPDATE + MAINTAIN.
GRANT SELECT, INSERT, UPDATE, MAINTAIN ON TABLE public.content_revisions TO authenticated;
--    anon tenía solo m = MAINTAIN.
GRANT MAINTAIN ON TABLE public.content_revisions TO anon;

COMMIT;

-- ============================================================================
-- REGLA 1 — el catálogo demuestra el estado restaurado
-- ============================================================================
SELECT
  (SELECT relrowsecurity FROM pg_class
     WHERE oid = 'public.clinical_prescriptions'::regclass)             AS cp_rls,
  (SELECT relrowsecurity FROM pg_class
     WHERE oid = 'public.content_revisions'::regclass)                  AS cr_rls,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'clinical_prescriptions') AS cp_politicas,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'content_revisions')   AS cr_politicas,
  (SELECT CASE WHEN has_table_privilege('authenticated','public.clinical_prescriptions','SELECT')     THEN 'r' ELSE '-' END
       || CASE WHEN has_table_privilege('authenticated','public.clinical_prescriptions','INSERT')     THEN 'a' ELSE '-' END
       || CASE WHEN has_table_privilege('authenticated','public.clinical_prescriptions','UPDATE')     THEN 'w' ELSE '-' END
       || CASE WHEN has_table_privilege('authenticated','public.clinical_prescriptions','DELETE')     THEN 'd' ELSE '-' END
       || CASE WHEN has_table_privilege('authenticated','public.clinical_prescriptions','TRUNCATE')   THEN 'D' ELSE '-' END
       || CASE WHEN has_table_privilege('authenticated','public.clinical_prescriptions','REFERENCES') THEN 'x' ELSE '-' END
       || CASE WHEN has_table_privilege('authenticated','public.clinical_prescriptions','TRIGGER')    THEN 't' ELSE '-' END
       || CASE WHEN has_table_privilege('authenticated','public.clinical_prescriptions','MAINTAIN')   THEN 'm' ELSE '-' END) AS cp_auth,
  (SELECT CASE WHEN has_table_privilege('authenticated','public.content_revisions','SELECT')     THEN 'r' ELSE '-' END
       || CASE WHEN has_table_privilege('authenticated','public.content_revisions','INSERT')     THEN 'a' ELSE '-' END
       || CASE WHEN has_table_privilege('authenticated','public.content_revisions','UPDATE')     THEN 'w' ELSE '-' END
       || CASE WHEN has_table_privilege('authenticated','public.content_revisions','DELETE')     THEN 'd' ELSE '-' END
       || CASE WHEN has_table_privilege('authenticated','public.content_revisions','TRUNCATE')   THEN 'D' ELSE '-' END
       || CASE WHEN has_table_privilege('authenticated','public.content_revisions','REFERENCES') THEN 'x' ELSE '-' END
       || CASE WHEN has_table_privilege('authenticated','public.content_revisions','TRIGGER')    THEN 't' ELSE '-' END
       || CASE WHEN has_table_privilege('authenticated','public.content_revisions','MAINTAIN')   THEN 'm' ELSE '-' END) AS cr_auth,
  (SELECT CASE WHEN has_table_privilege('anon','public.content_revisions','MAINTAIN') THEN 'm' ELSE '-' END) AS cr_anon_m,
  (SELECT array_to_string(relacl, ', ') FROM pg_class
     WHERE oid = 'public.clinical_prescriptions'::regclass)             AS cp_acl,
  (SELECT array_to_string(relacl, ', ') FROM pg_class
     WHERE oid = 'public.content_revisions'::regclass)                  AS cr_acl,
  (SELECT count(*) FROM information_schema.column_privileges
    WHERE table_schema = 'public' AND table_name = 'clinical_prescriptions'
      AND grantee = 'authenticated')                                    AS cp_grants_col,
  (SELECT count(*) FROM information_schema.column_privileges
    WHERE table_schema = 'public' AND table_name = 'content_revisions'
      AND grantee = 'authenticated')                                    AS cr_grants_col,
  (SELECT count(*) FROM public.clinical_prescriptions)                  AS cp_filas,
  (SELECT count(*) FROM public.content_revisions)                       AS cr_filas,
  (SELECT md5(string_agg(id::text, '|' ORDER BY id))
     FROM public.clinical_prescriptions)                                AS cp_huella,
  (SELECT count(*) FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity) AS tablas_con_rls,
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'public')        AS politicas_public;
