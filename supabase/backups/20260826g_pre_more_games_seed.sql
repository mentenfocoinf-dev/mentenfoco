-- ============================================================================
-- BACKUP / ROLLBACK previo a 20260826g_more_games_seed.sql (lote 3, 2 juegos).
--
-- El rollback borra los 2 nuevos por slug. Los valores del enum
-- exercise_game_kind (dia_siguiente, respuesta_adecuada) NO se pueden eliminar
-- en Postgres; quedan inertes si no se usan (limitación conocida).
-- ============================================================================

BEGIN;

DELETE FROM public.cognitive_exercises
  WHERE slug IN ('que-dia-sigue', 'respuesta-adecuada');

COMMIT;

SELECT (SELECT count(*) FROM public.cognitive_exercises WHERE status='publicado') AS publicados;
