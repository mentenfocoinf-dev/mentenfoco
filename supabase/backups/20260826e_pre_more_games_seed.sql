-- ============================================================================
-- BACKUP / ROLLBACK previo a 20260826e_more_games_seed.sql (lote 2, 6 juegos).
--
-- El rollback borra los 6 nuevos por slug. Los valores del enum
-- exercise_game_kind (cuenta_rapido, patron_igual, que_hora, emocion_situacion,
-- ordena_pasos, forma_palabra) NO se pueden eliminar en Postgres; quedan inertes
-- si no se usan (limitación conocida).
-- ============================================================================

BEGIN;

DELETE FROM public.cognitive_exercises
  WHERE slug IN ('cuenta-rapido', 'patron-igual', 'que-hora-es',
                 'ordena-los-pasos', 'forma-la-palabra', 'emocion-situacion');

COMMIT;

SELECT (SELECT count(*) FROM public.cognitive_exercises WHERE status='publicado') AS publicados;
