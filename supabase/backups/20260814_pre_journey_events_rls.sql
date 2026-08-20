-- ============================================================================
-- BACKUP previo a 20260814_journey_events_rls.sql
--
-- Estado de public.journey_events el 14 de agosto de 2026, ANTES de activar RLS.
-- Generado leyendo el catálogo (pg_class, pg_policies, pg_constraint, pg_trigger,
-- pg_index, information_schema.column_privileges), no de memoria.
--
-- ESTADO CAPTURADO — los 33 criterios reconfirmados en la Fase 1:
--
--   relrowsecurity ...................... false
--   relforcerowsecurity ................. false
--   reloptions .......................... (NULL)
--   owner ............................... postgres
--   políticas ........................... 0
--   filas ............................... 58
--   columnas ............................ 17
--   CHECK propios ....................... 4
--   FK salientes ........................ 1   (user_id → profiles ON DELETE SET NULL)
--   FK entrantes ........................ 0
--   índices ............................. 6
--   triggers propios .................... 2
--   funciones de public que la citan .... 2   (las dos RPC SECURITY DEFINER)
--   vistas dependientes ................. 0
--   Realtime / Broadcast ................ 0
--
--   ACL literal:
--     postgres=arwdDxtm/postgres, anon=axtm/postgres,
--     authenticated=am/postgres, service_role=arwdDxtm/postgres
--     anon           -a---xt
--     authenticated  -a-----
--     service_role   rawdDxt   (bypassrls)
--
--   grants por columna: anon 34 (17 INSERT + 17 REFERENCES), authenticated 17 (INSERT)
--
--   huella de DATOS (md5 de los id ordenados) . b665413435357e179e8c73c7755b3047
--
--   Globales:
--     RLS 28/37 · FORCE 0/37 · políticas 91
--     huella RLS ....... 0fb82001e4427a9482a42a74ba988e08
--     huella POL ....... 85e46556689e96c5425e365881bc6a84
--     huella ACL ....... c9a0182c86c1912385ee672d54f8c6c3
--     huella TRIGGERS .. 3ca1288a327c51ad66d698009c86eb79
--     huella FUNCTIONS . e5e288e79a4b6f5b9364d7ffe902b7e1
--     huella FK ........ cfb706920529fb9470ccbbf757a6537c
--     huella INDEXES ... 6da61f8c851e3cf908ed5e2cb2d0e19a
--     huella VIEWS ..... b23db2e27087288f50410d711cbf8de4
--
-- QUÉ HACE ESTE ROLLBACK: elimina la única política creada y desactiva RLS.
--
-- QUÉ NO TOCA, PORQUE LA MIGRACIÓN TAMPOCO LO TOCÓ: la ACL de tabla, los 51
-- grants por columna, los 2 triggers, las 2 RPC, la FK, los 6 índices, los 4
-- CHECK, los datos y cualquier otra tabla. Nada de eso necesita restauración
-- porque nada de eso cambia.
--
-- NO se usa `ALTER TABLE ... NO FORCE`: FORCE nunca se activó y tocarlo sería
-- introducir un cambio que la migración no hizo.
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS "Everyone records their own journey" ON public.journey_events;

ALTER TABLE public.journey_events DISABLE ROW LEVEL SECURITY;

COMMIT;

-- ============================================================================
-- REGLA 1 — el catálogo demuestra el estado restaurado
-- ============================================================================
SELECT
  (SELECT relrowsecurity FROM pg_class
     WHERE oid = 'public.journey_events'::regclass)                     AS rls_activo,
  (SELECT relforcerowsecurity FROM pg_class
     WHERE oid = 'public.journey_events'::regclass)                     AS force_activo,
  (SELECT coalesce(array_to_string(reloptions, ','), '(NULL)') FROM pg_class
     WHERE oid = 'public.journey_events'::regclass)                     AS reloptions,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'journey_events')      AS politicas,
  (SELECT count(*) FROM public.journey_events)                          AS filas,
  (SELECT md5(string_agg(id::text, '|' ORDER BY id))
     FROM public.journey_events)                                        AS huella_datos,
  (SELECT array_to_string(relacl, ', ') FROM pg_class
     WHERE oid = 'public.journey_events'::regclass)                     AS acl_literal,
  (SELECT count(*) FROM information_schema.column_privileges
    WHERE table_schema = 'public' AND table_name = 'journey_events'
      AND grantee IN ('anon', 'authenticated'))                         AS grants_columna,
  (SELECT count(*) FROM pg_trigger
     WHERE tgrelid = 'public.journey_events'::regclass
       AND NOT tgisinternal)                                            AS triggers,
  (SELECT count(*) FROM pg_index
     WHERE indrelid = 'public.journey_events'::regclass)                AS indices,
  (SELECT count(*) FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity) AS tablas_con_rls,
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'public')        AS politicas_public;
