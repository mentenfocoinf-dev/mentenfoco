-- ============================================================================
-- Rehabilitación cognitiva — seed lote 3 (2 juegos → ≥2 en TODAS las áreas).
-- Requiere 20260826f_add_game_kinds_batch3.sql aplicado.
--
--   dia_siguiente      → Orientación                  (free)
--   respuesta_adecuada → Cognición social, Comprensión (integral)
--
-- Cada dificultad con 5 subniveles ascendentes (solo baja el tiempo). Ninguno
-- visible_anonimo. Backup: supabase/backups/20260826g_pre_more_games_seed.sql.
-- Idempotente: ON CONFLICT (slug) DO UPDATE.
-- ============================================================================

BEGIN;

INSERT INTO public.cognitive_exercises
  (slug, title, description, instructions, game_kind, domains, age_band, min_plan, visible_anonimo, config, status)
VALUES
  ('que-dia-sigue', '¿Qué día sigue?',
   'Ubícate en el tiempo: elige el día o el mes que viene antes o después.',
   'Verás un día de la semana o un mes. Toca cuál viene antes o después, según se pida, antes de que acabe el tiempo. Cada dificultad tiene 5 subniveles con menos tiempo.',
   'dia_siguiente', ARRAY['orientacion'], 'adultos', 'free', false,
   '{"levels":{"facil":[{"ms":12000},{"ms":11000},{"ms":10000},{"ms":9000},{"ms":8000}],"medio":[{"ms":7500},{"ms":7000},{"ms":6500},{"ms":6000},{"ms":5500}],"dificil":[{"ms":5000},{"ms":4500},{"ms":4000},{"ms":3500},{"ms":3000}]}}'::jsonb,
   'publicado'),
  ('respuesta-adecuada', 'La respuesta adecuada',
   'Lee una situación con otras personas y elige la respuesta más apropiada.',
   'Se describe una situación cotidiana con otra persona. Entre las opciones, toca la respuesta más adecuada antes de que acabe el tiempo. Cada dificultad tiene 5 subniveles con menos tiempo.',
   'respuesta_adecuada', ARRAY['cognicion_social','comprension'], 'adultos', 'integral', false,
   '{"levels":{"facil":[{"ms":13000},{"ms":12000},{"ms":11000},{"ms":10000},{"ms":9000}],"medio":[{"ms":8500},{"ms":8000},{"ms":7500},{"ms":7000},{"ms":6500}],"dificil":[{"ms":6000},{"ms":5500},{"ms":5000},{"ms":4500},{"ms":4000}]}}'::jsonb,
   'publicado')
ON CONFLICT (slug) DO UPDATE SET
  title=EXCLUDED.title, description=EXCLUDED.description, instructions=EXCLUDED.instructions,
  game_kind=EXCLUDED.game_kind, domains=EXCLUDED.domains, age_band=EXCLUDED.age_band,
  min_plan=EXCLUDED.min_plan, visible_anonimo=EXCLUDED.visible_anonimo, config=EXCLUDED.config,
  status=EXCLUDED.status, updated_at=now();

COMMIT;

SELECT
  (SELECT count(*) FROM public.cognitive_exercises WHERE status='publicado') AS publicados,
  (SELECT string_agg(slug, ', ' ORDER BY slug) FROM public.cognitive_exercises
     WHERE game_kind IN ('dia_siguiente','respuesta_adecuada')) AS nuevos;
