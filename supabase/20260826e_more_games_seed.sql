-- ============================================================================
-- Rehabilitación cognitiva — seed lote 2 (6 juegos → ≥2 por área).
-- Requiere 20260826d_add_game_kinds_batch2.sql aplicado (enum con los valores).
--
--   cuenta_rapido      → Cálculo, Atención sostenida            (free)
--   patron_igual       → Visoespacial, Atención selectiva       (free)
--   que_hora           → Orientación                            (free)
--   ordena_pasos       → Funciones ejecutivas, Comprensión      (esencial)
--   forma_palabra      → Lenguaje                               (esencial)
--   emocion_situacion  → Cognición social, Comprensión          (integral)
--
-- Cada dificultad con 5 subniveles ascendentes. Gradiente de tier conservado;
-- ninguno visible_anonimo → el anónimo sigue viendo pocos.
-- Backup: supabase/backups/20260826e_pre_more_games_seed.sql (borra las filas).
-- Idempotente: ON CONFLICT (slug) DO UPDATE.
-- ============================================================================

BEGIN;

INSERT INTO public.cognitive_exercises
  (slug, title, description, instructions, game_kind, domains, age_band, min_plan, visible_anonimo, config, status)
VALUES
  ('cuenta-rapido', 'Cuenta rápido',
   'Cuenta cuántos puntos de un color hay antes de que acabe el tiempo.',
   'Verás varios puntos de dos colores. Cuenta cuántos hay del color que se te pide y toca el número correcto antes de que se agote el tiempo. Cada dificultad tiene 5 subniveles: más puntos y menos tiempo.',
   'cuenta_rapido', ARRAY['calculo','atencion_sostenida'], 'adultos', 'free', false,
   '{"levels":{"facil":[{"total":6,"ms":9000},{"total":8,"ms":8500},{"total":10,"ms":8000},{"total":12,"ms":7500},{"total":14,"ms":7000}],"medio":[{"total":14,"ms":6000},{"total":16,"ms":5600},{"total":18,"ms":5200},{"total":20,"ms":4800},{"total":22,"ms":4500}],"dificil":[{"total":22,"ms":4000},{"total":25,"ms":3600},{"total":28,"ms":3200},{"total":32,"ms":3000},{"total":36,"ms":2800}]}}'::jsonb,
   'publicado'),
  ('patron-igual', 'Patrón igual',
   'Elige la cuadrícula de colores idéntica al modelo.',
   'Arriba verás un patrón de colores. Entre las opciones, toca la cuadrícula que es exactamente igual al modelo antes de que acabe el tiempo. Cada dificultad tiene 5 subniveles con menos tiempo.',
   'patron_igual', ARRAY['visualizacion_espacial','atencion_selectiva'], 'adultos', 'free', false,
   '{"levels":{"facil":[{"ms":9000},{"ms":8000},{"ms":7000},{"ms":6000},{"ms":5000}],"medio":[{"ms":4800},{"ms":4400},{"ms":4000},{"ms":3600},{"ms":3200}],"dificil":[{"ms":3000},{"ms":2600},{"ms":2300},{"ms":2000},{"ms":1700}]}}'::jsonb,
   'publicado'),
  ('que-hora-es', '¿Qué hora es?',
   'Lee el reloj y elige la hora correcta.',
   'Verás un reloj de agujas. Entre las opciones, toca la hora que marca antes de que acabe el tiempo. Cada dificultad tiene 5 subniveles con menos tiempo.',
   'que_hora', ARRAY['orientacion'], 'adultos', 'free', false,
   '{"levels":{"facil":[{"ms":12000},{"ms":11000},{"ms":10000},{"ms":9000},{"ms":8000}],"medio":[{"ms":7500},{"ms":7000},{"ms":6500},{"ms":6000},{"ms":5500}],"dificil":[{"ms":5000},{"ms":4500},{"ms":4000},{"ms":3500},{"ms":3000}]}}'::jsonb,
   'publicado'),
  ('ordena-los-pasos', 'Ordena los pasos',
   'Toca los pasos de una actividad cotidiana en el orden correcto.',
   'Se te muestra una actividad y sus pasos desordenados. Tócalos en el orden correcto para completarla. Cada dificultad tiene 5 subniveles: más rondas y pasos.',
   'ordena_pasos', ARRAY['planificacion','comprension'], 'adultos', 'esencial', false,
   '{"levels":{"facil":[{"rounds":3,"maxSteps":3},{"rounds":3,"maxSteps":4},{"rounds":4,"maxSteps":4},{"rounds":4,"maxSteps":4},{"rounds":5,"maxSteps":4}],"medio":[{"rounds":4,"maxSteps":5},{"rounds":5,"maxSteps":5},{"rounds":5,"maxSteps":5},{"rounds":6,"maxSteps":5},{"rounds":6,"maxSteps":5}],"dificil":[{"rounds":6,"maxSteps":5},{"rounds":7,"maxSteps":5},{"rounds":8,"maxSteps":5},{"rounds":8,"maxSteps":5},{"rounds":10,"maxSteps":5}]}}'::jsonb,
   'publicado'),
  ('forma-la-palabra', 'Forma la palabra',
   'Con una pista y unas letras revueltas, arma la palabra correcta.',
   'Lee la pista y toca las letras revueltas en orden para formar la palabra. Puedes borrar la última letra si te equivocas. Cada dificultad tiene 5 subniveles: palabras más largas y más rondas.',
   'forma_palabra', ARRAY['lenguaje'], 'adultos', 'esencial', false,
   '{"levels":{"facil":[{"rounds":4,"maxLen":4},{"rounds":4,"maxLen":4},{"rounds":5,"maxLen":5},{"rounds":5,"maxLen":5},{"rounds":6,"maxLen":6}],"medio":[{"rounds":5,"maxLen":6},{"rounds":5,"maxLen":7},{"rounds":6,"maxLen":7},{"rounds":6,"maxLen":8},{"rounds":6,"maxLen":8}],"dificil":[{"rounds":6,"maxLen":8},{"rounds":6,"maxLen":9},{"rounds":7,"maxLen":9},{"rounds":8,"maxLen":9},{"rounds":8,"maxLen":9}]}}'::jsonb,
   'publicado'),
  ('emocion-situacion', 'Emoción y situación',
   'Lee una situación cotidiana y elige la emoción que mejor encaja.',
   'Se describe una situación breve. Entre las opciones, toca la emoción que sentiría la persona antes de que acabe el tiempo. Cada dificultad tiene 5 subniveles con menos tiempo.',
   'emocion_situacion', ARRAY['cognicion_social','comprension'], 'adultos', 'integral', false,
   '{"levels":{"facil":[{"ms":12000},{"ms":11000},{"ms":10000},{"ms":9000},{"ms":8000}],"medio":[{"ms":7500},{"ms":7000},{"ms":6500},{"ms":6000},{"ms":5500}],"dificil":[{"ms":5000},{"ms":4600},{"ms":4200},{"ms":3800},{"ms":3400}]}}'::jsonb,
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
     WHERE game_kind IN ('cuenta_rapido','patron_igual','que_hora','ordena_pasos','forma_palabra','emocion_situacion')) AS nuevos;
