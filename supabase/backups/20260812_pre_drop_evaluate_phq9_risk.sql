-- ============================================================================
-- BACKUP DE REVERSION · retirada del trigger muerto del PHQ-9
-- Fecha: 12 de agosto de 2026
--
-- Revierte la migracion `20260812_drop_evaluate_phq9_risk.sql`, que elimina el
-- trigger `tr_evaluate_phq9_risk` y su funcion `evaluate_phq9_risk()`.
--
-- Ejecutar este archivo los recrea EXACTAMENTE como estaban: las definiciones
-- de abajo salen de `pg_get_functiondef()` y `pg_get_triggerdef()`, no de una
-- transcripcion.
--
-- ── Estado capturado ANTES de la migracion ──────────────────────────────────
--
--   evaluate_phq9_risk()  SECURITY DEFINER · owner postgres · bypassrls=true
--                         search_path = public, pg_temp
--                         md5 del cuerpo: fe63206cf719b6256430ce732d448460
--   tr_evaluate_phq9_risk AFTER INSERT ON public.test_scores FOR EACH ROW
--
--   test_scores ............... 0 filas · RLS false · 0 politicas
--                               relacl {postgres=arwdDxtm, anon=arwxtm,
--                                       authenticated=arwm, service_role=arwdDxtm}
--   psychometric_evaluations .. 40 filas · RLS false · 4 politicas
--   clinical_alerts ........... 2 filas · RLS TRUE · 6 politicas
--   clinical_alerts.test_score_id -> psychometric_evaluations(id) ON DELETE CASCADE
--
-- ── Huellas del esquema en el momento del backup ────────────────────────────
--
--   ACL de las 37 tablas .. 64cdb69b1241ea34ac996556da08dc19
--   42 triggers ........... 217dffa660659d3cf920f78d1ca5f344
--   62 foreign keys ....... b9087924187f648a75b1677f7e8cd3ea
--   274 funciones ......... a093e1446067405c4d51432b46e6f543
--   52 politicas .......... dd8bfdfc97b8d247fc751ba58633652c
--   RLS ................... 12 de 37 · FORCE 0 de 37
--
-- ── Advertencia sobre revertir ──────────────────────────────────────────────
--
-- Recrear este trigger devuelve el defecto: cualquier INSERT en `test_scores`
-- con `item_9_score > 0` volvera a fallar con
-- `23503 violates foreign key constraint clinical_alerts_test_score_id_fkey`,
-- porque escribe un id de `test_scores` en una columna que exige uno de
-- `psychometric_evaluations`. Solo tiene sentido revertir si se descubre un
-- consumidor de `test_scores` que hoy no existe.
--
-- ── Idempotencia ────────────────────────────────────────────────────────────
--
-- `CREATE OR REPLACE FUNCTION` y el `DROP TRIGGER IF EXISTS` previo al
-- `CREATE TRIGGER` permiten ejecutarlo las veces que haga falta.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.evaluate_phq9_risk()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    IF NEW.item_9_score > 0 THEN
        INSERT INTO public.clinical_alerts (patient_id, test_score_id, status)
        VALUES (NEW.patient_id, NEW.id, 'high_priority');
    END IF;
    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tr_evaluate_phq9_risk ON public.test_scores;

CREATE TRIGGER tr_evaluate_phq9_risk
  AFTER INSERT ON public.test_scores
  FOR EACH ROW EXECUTE FUNCTION evaluate_phq9_risk();

-- ─── Comprobacion posterior a la reversion ──────────────────────────────────
--
-- SELECT md5(prosrc) FROM pg_proc
--  WHERE pronamespace = 'public'::regnamespace AND proname = 'evaluate_phq9_risk';
--   -> fe63206cf719b6256430ce732d448460
--
-- SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
--  WHERE c.relnamespace = 'public'::regnamespace AND NOT t.tgisinternal;
--   -> 42
