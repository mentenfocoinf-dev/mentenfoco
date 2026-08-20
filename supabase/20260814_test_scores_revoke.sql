-- ============================================================================
-- Sprint test_scores — cierre reversible (opción A′)
--
-- UNA sola sentencia. Ni RLS, ni políticas, ni DROP.
--
-- POR QUÉ REVOKE Y NO RLS:
--
--   `test_scores` es la tabla previa a `psychometric_evaluations`. Está vacía,
--   no tiene consumidores ejecutables y nada depende de ella. Lo único abierto
--   era la ESCRITURA, medido sin sesión ninguna:
--
--     anon  SELECT las 6 columnas ................ 0 filas (vacía; la ACL sí concedía)
--     anon  INSERT patient_id ajeno, item_9=3 .... SE CREA      ninguna capa
--     anon  INSERT sin paciente, puntajes 999 .... SE CREA      ninguna capa (0 CHECK)
--     anon  UPDATE de todas las filas ............ MODIFICA     ninguna capa
--     anon  DELETE / TRUNCATE .................... 42501        ACL
--
--   Es decir: un visitante sin sesión podía fabricar un registro de ideación
--   suicida a nombre de un paciente real. No es una fuga de lectura —no hay nada
--   que leer—, es escritura.
--
--   Y RLS NO ES LA HERRAMIENTA. Una política filtra los privilegios que ya
--   existen; no los quita. Revocado INSERT y UPDATE, a RLS no le queda nada que
--   filtrar: sería una política sobre privilegios inexistentes, y además
--   convertiría en permanente una tabla que está pendiente de eliminación.
--   El REVOKE cierra de raíz lo que RLS solo taparía.
--
-- POR QUÉ NO SE ELIMINA HOY:
--
--   Eliminarla es la conclusión correcta —lo dejó escrito
--   `20260701_fix_clinical_alerts_fk.sql` el 1 de julio: «queda sin usar pero no
--   se borra en esta migración; decisión de limpieza separada»— pero sería la
--   primera operación irreversible del plan, y PITR está desactivado con cero
--   copias de seguridad. Se difiere hasta que existan copias.
--
--   Además, la tabla NO está en ninguna migración del repositorio: no hay
--   CREATE TABLE, ni ALTER, ni COMMENT. Se creó fuera del control de
--   migraciones. El backup del futuro DROP tendrá que reconstruir el DDL
--   completo desde el catálogo, o la definición se pierde.
--
-- LO QUE NO CAMBIA, Y CONVIENE NO ATRIBUIRLE MÉRITO A ESTA MIGRACIÓN:
--
--   · `clinical_alerts.test_score_id` conserva su nombre y su FK, que apunta a
--     `psychometric_evaluations(id)` desde el 1 de julio. Un id de `test_scores`
--     no puede entrar ahí: daría 23503. Las 2 alertas la tienen a NULL.
--     El renombrado a `evaluation_id` queda FUERA de alcance.
--   · El trigger `tr_evaluate_phq9_risk` y la función `evaluate_phq9_risk()` ya
--     no existen: los eliminó `20260812_drop_evaluate_phq9_risk.sql`.
--   · `psychometric_evaluations` sigue con 40 filas, RLS y 5 políticas.
--
-- POR QUÉ SE REVOCA TAMBIÉN SELECT, REFERENCES, TRIGGER Y MAINTAIN:
--
--   Nadie lee esta tabla —0 consumidores— así que SELECT no hace falta. Y
--   REFERENCES/TRIGGER en `anon` son el residuo de H-TRIGGER-001 que otras diez
--   tablas ya perdieron. `REVOKE ALL` los quita todos de una vez y no deja
--   privilegios residuales que haya que recordar después.
--
--   Nota de nomenclatura: la ACL real de `authenticated` es `arwm`, es decir
--   `raw----m` con MAINTAIN incluido. La notación de siete letras usada en
--   informes anteriores no mostraba ese bit; el estado nunca fue distinto.
--
-- QUÉ NO TOCA:
-- los privilegios de `postgres` y `service_role`, el estado RLS (sigue false),
-- las políticas (siguen 0), el propietario, los 4 defaults, la FK a `profiles`,
-- el índice, los datos (0 filas), `clinical_alerts`, `psychometric_evaluations`
-- ni ninguna otra tabla. No se usa CASCADE.
--
-- Backup: supabase/backups/20260814_pre_test_scores_revoke.sql
-- Diagnóstico: contexto-proyecto/auditorias-tecnicas/Diagnostico_test_scores_2026-08-14.md
--
-- Idempotente por naturaleza: REVOKE sobre lo ya revocado no falla ni cambia nada.
-- ============================================================================

BEGIN;

REVOKE ALL PRIVILEGES
  ON TABLE public.test_scores
  FROM anon, authenticated;

COMMIT;

-- ============================================================================
-- REGLA 1 — el catálogo demuestra el estado final
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
  (SELECT CASE WHEN has_table_privilege('postgres','public.test_scores','SELECT')     THEN 'r' ELSE '-' END
       || CASE WHEN has_table_privilege('postgres','public.test_scores','INSERT')     THEN 'a' ELSE '-' END
       || CASE WHEN has_table_privilege('postgres','public.test_scores','UPDATE')     THEN 'w' ELSE '-' END
       || CASE WHEN has_table_privilege('postgres','public.test_scores','DELETE')     THEN 'd' ELSE '-' END
       || CASE WHEN has_table_privilege('postgres','public.test_scores','TRUNCATE')   THEN 'D' ELSE '-' END
       || CASE WHEN has_table_privilege('postgres','public.test_scores','REFERENCES') THEN 'x' ELSE '-' END
       || CASE WHEN has_table_privilege('postgres','public.test_scores','TRIGGER')    THEN 't' ELSE '-' END
       || CASE WHEN has_table_privilege('postgres','public.test_scores','MAINTAIN')   THEN 'm' ELSE '-' END) AS postgres,
  (SELECT count(*) FROM information_schema.column_privileges
    WHERE table_schema = 'public' AND table_name = 'test_scores'
      AND grantee IN ('anon','authenticated'))                          AS grants_columna,
  (SELECT relrowsecurity FROM pg_class
     WHERE oid = 'public.test_scores'::regclass)                        AS rls_activo,
  (SELECT relforcerowsecurity FROM pg_class
     WHERE oid = 'public.test_scores'::regclass)                        AS force_activo,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'test_scores')         AS politicas,
  (SELECT count(*) FROM public.test_scores)                             AS filas,
  (SELECT pg_get_userbyid(relowner) FROM pg_class
     WHERE oid = 'public.test_scores'::regclass)                        AS owner,
  (SELECT count(*) FROM pg_trigger
     WHERE tgrelid = 'public.test_scores'::regclass AND NOT tgisinternal) AS triggers,
  (SELECT count(*) FROM pg_constraint
     WHERE conrelid = 'public.test_scores'::regclass AND contype = 'f') AS fk_salientes,
  (SELECT confrelid::regclass::text FROM pg_constraint
     WHERE conname = 'clinical_alerts_test_score_id_fkey')              AS fk_alertas_apunta_a,
  (SELECT count(*) FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity) AS tablas_con_rls,
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'public')        AS politicas_public;
