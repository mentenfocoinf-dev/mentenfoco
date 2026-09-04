-- ============================================================================
-- BACKUP / ROLLBACK previo a 20260826c_more_games_seed.sql
--
-- Antes del seed existían 3 ejercicios (pares-de-memoria, stroop-de-colores,
-- secuencia). El rollback borra los 3 nuevos por slug. Los valores del enum
-- exercise_game_kind (calculo_mental, odd_one_out, figuras_iguales) NO se pueden
-- eliminar en Postgres; quedan inertes si no se usan (limitación conocida).
-- ============================================================================

BEGIN;

DELETE FROM public.cognitive_exercises
  WHERE slug IN ('calculo-mental', 'encuentra-el-diferente', 'figuras-iguales');

COMMIT;

SELECT (SELECT count(*) FROM public.cognitive_exercises WHERE status='publicado') AS publicados;
