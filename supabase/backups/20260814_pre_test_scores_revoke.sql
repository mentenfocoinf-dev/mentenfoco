-- ============================================================================
-- BACKUP previo a 20260814_test_scores_revoke.sql
--
-- Estado de los privilegios de public.test_scores el 14 de agosto de 2026,
-- ANTES de revocar a anon y authenticated. Generado leyendo el catálogo
-- (pg_class.relacl y has_table_privilege), no de memoria.
--
-- ESTADO CAPTURADO — los 36 criterios reconfirmados en la Fase 1:
--
--   ACL literal:
--     postgres=arwdDxtm/postgres, anon=arwxtm/postgres,
--     authenticated=arwm/postgres, service_role=arwdDxtm/postgres
--
--   Verificado con has_table_privilege, los OCHO privilegios:
--
--     rol             SELECT INSERT UPDATE DELETE TRUNC  REFER  TRIGG  MAINT   resumen
--     anon            SI     SI     SI     no     no     SI     SI     SI      raw--xtm
--     authenticated   SI     SI     SI     no     no     no     no     SI      raw----m
--     service_role    SI     SI     SI     SI     SI     SI     SI     SI      rawdDxtm
--     postgres        SI     SI     SI     SI     SI     SI     SI     SI      rawdDxtm
--
--   NOTA: la ACL de `authenticated` incluye MAINTAIN ('m'). La notación de siete
--   letras usada en informes anteriores no mostraba ese bit. El estado nunca fue
--   distinto; la notación era incompleta.
--
--   grants por columna: anon 24 (SELECT/INSERT/UPDATE/REFERENCES x6)
--                       authenticated 18 (SELECT/INSERT/UPDATE x6)
--
--   owner ................. postgres        filas ................. 0
--   relrowsecurity ........ false           columnas .............. 6
--   relforcerowsecurity ... false           defaults .............. 4
--   reloptions ............ (NULL)          CHECK propios ......... 0
--   políticas ............. 0               triggers propios ...... 0
--   FK salientes .......... 1               FK entrantes .......... 0
--   índices ............... 1               vistas ................ 0
--   funciones que la citan  0               Realtime / Broadcast .. 0
--   pg_depend ............. 8 (todas internas; 0 constraints externas)
--   huella de datos ....... (VACÍA)
--
--   Constraints:
--     test_scores_pkey             PRIMARY KEY (id)
--     test_scores_patient_id_fkey  FOREIGN KEY (patient_id)
--                                  REFERENCES profiles(id) ON DELETE CASCADE
--   Índice:
--     CREATE UNIQUE INDEX test_scores_pkey ON public.test_scores USING btree (id)
--
--   Entorno:
--     clinical_alerts_test_score_id_fkey -> psychometric_evaluations   (2 filas)
--     psychometric_evaluations ........................................ 40 filas
--     RLS 29/37 · FORCE 0/37 · políticas 92
--     huella ACL ....... c9a0182c86c1912385ee672d54f8c6c3
--     huella POL ....... 345c6ca68f28c4f7dcaeca378e325228
--     huella RLS ....... 7e14abca5e88bd6d1aade67391ceedab
--     huella TRIGGERS .. 3ca1288a327c51ad66d698009c86eb79
--     huella FUNCTIONS . e5e288e79a4b6f5b9364d7ffe902b7e1
--     huella FK ........ cfb706920529fb9470ccbbf757a6537c
--     huella INDEXES ... 6da61f8c851e3cf908ed5e2cb2d0e19a
--     huella VIEWS ..... b23db2e27087288f50410d711cbf8de4
--
-- QUÉ HACE ESTE ROLLBACK: devuelve a `anon` y a `authenticated` exactamente los
-- privilegios que tenían, ni uno más. Los GRANT están escritos privilegio a
-- privilegio a partir de la tabla de arriba, no con un `ALL` que concedería de
-- más: `anon` NO tenía DELETE ni TRUNCATE, y `authenticated` tampoco tenía
-- REFERENCES ni TRIGGER.
--
-- QUÉ NO TOCA, PORQUE LA MIGRACIÓN TAMPOCO LO TOCÓ: los privilegios de
-- `postgres` y de `service_role`, el estado RLS —que sigue en false—, las
-- políticas —que siguen en 0—, el propietario, los triggers, las funciones, la
-- FK, el índice, los datos, `clinical_alerts`, `psychometric_evaluations` y
-- cualquier otra tabla.
--
-- ESTE BACKUP NO CONTIENE NINGÚN DDL DE DROP NI DE CREATE TABLE. La eliminación
-- de `test_scores` es una decisión aplazada (opción A′): se hará cuando existan
-- copias de seguridad, y su backup tendrá que reconstruir el DDL completo,
-- porque la tabla NO está en ninguna migración del repositorio.
--
-- Los grants por columna no se restauran por separado: en esta tabla reproducen
-- los de tabla y no los recortan, así que los GRANT de abajo los reponen.
-- ============================================================================

BEGIN;

-- anon: raw--xtm  (sin DELETE, sin TRUNCATE)
GRANT SELECT, INSERT, UPDATE, REFERENCES, TRIGGER, MAINTAIN
  ON TABLE public.test_scores TO anon;

-- authenticated: raw----m  (sin DELETE, TRUNCATE, REFERENCES ni TRIGGER)
GRANT SELECT, INSERT, UPDATE, MAINTAIN
  ON TABLE public.test_scores TO authenticated;

COMMIT;

-- ============================================================================
-- REGLA 1 — el catálogo demuestra el estado restaurado
-- ============================================================================
SELECT
  (SELECT array_to_string(relacl, ', ') FROM pg_class
     WHERE oid = 'public.test_scores'::regclass)                        AS acl_literal,
  (SELECT CASE WHEN has_table_privilege('anon','public.test_scores','SELECT')     THEN 'r' ELSE '-' END
       || CASE WHEN has_table_privilege('anon','public.test_scores','INSERT')     THEN 'a' ELSE '-' END
       || CASE WHEN has_table_privilege('anon','public.test_scores','UPDATE')     THEN 'w' ELSE '-' END
       || CASE WHEN has_table_privilege('anon','public.test_scores','DELETE')     THEN 'd' ELSE '-' END
       || CASE WHEN has_table_privilege('anon','public.test_scores','TRUNCATE')   THEN 'D' ELSE '-' END
       || CASE WHEN has_table_privilege('anon','public.test_scores','REFERENCES') THEN 'x' ELSE '-' END
       || CASE WHEN has_table_privilege('anon','public.test_scores','TRIGGER')    THEN 't' ELSE '-' END
       || CASE WHEN has_table_privilege('anon','public.test_scores','MAINTAIN')   THEN 'm' ELSE '-' END) AS anon,
  (SELECT CASE WHEN has_table_privilege('authenticated','public.test_scores','SELECT')     THEN 'r' ELSE '-' END
       || CASE WHEN has_table_privilege('authenticated','public.test_scores','INSERT')     THEN 'a' ELSE '-' END
       || CASE WHEN has_table_privilege('authenticated','public.test_scores','UPDATE')     THEN 'w' ELSE '-' END
       || CASE WHEN has_table_privilege('authenticated','public.test_scores','DELETE')     THEN 'd' ELSE '-' END
       || CASE WHEN has_table_privilege('authenticated','public.test_scores','TRUNCATE')   THEN 'D' ELSE '-' END
       || CASE WHEN has_table_privilege('authenticated','public.test_scores','REFERENCES') THEN 'x' ELSE '-' END
       || CASE WHEN has_table_privilege('authenticated','public.test_scores','TRIGGER')    THEN 't' ELSE '-' END
       || CASE WHEN has_table_privilege('authenticated','public.test_scores','MAINTAIN')   THEN 'm' ELSE '-' END) AS authenticated,
  (SELECT CASE WHEN has_table_privilege('service_role','public.test_scores','SELECT')     THEN 'r' ELSE '-' END
       || CASE WHEN has_table_privilege('service_role','public.test_scores','INSERT')     THEN 'a' ELSE '-' END
       || CASE WHEN has_table_privilege('service_role','public.test_scores','UPDATE')     THEN 'w' ELSE '-' END
       || CASE WHEN has_table_privilege('service_role','public.test_scores','DELETE')     THEN 'd' ELSE '-' END
       || CASE WHEN has_table_privilege('service_role','public.test_scores','TRUNCATE')   THEN 'D' ELSE '-' END
       || CASE WHEN has_table_privilege('service_role','public.test_scores','REFERENCES') THEN 'x' ELSE '-' END
       || CASE WHEN has_table_privilege('service_role','public.test_scores','TRIGGER')    THEN 't' ELSE '-' END
       || CASE WHEN has_table_privilege('service_role','public.test_scores','MAINTAIN')   THEN 'm' ELSE '-' END) AS service_role,
  (SELECT count(*) FROM information_schema.column_privileges
    WHERE table_schema = 'public' AND table_name = 'test_scores'
      AND grantee = 'anon')                                             AS grants_col_anon,
  (SELECT count(*) FROM information_schema.column_privileges
    WHERE table_schema = 'public' AND table_name = 'test_scores'
      AND grantee = 'authenticated')                                    AS grants_col_auth,
  (SELECT relrowsecurity FROM pg_class
     WHERE oid = 'public.test_scores'::regclass)                        AS rls_activo,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'test_scores')         AS politicas,
  (SELECT count(*) FROM public.test_scores)                             AS filas,
  (SELECT pg_get_userbyid(relowner) FROM pg_class
     WHERE oid = 'public.test_scores'::regclass)                        AS owner,
  (SELECT count(*) FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity) AS tablas_con_rls,
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'public')        AS politicas_public;
