-- ============================================================================
-- Rehabilitación cognitiva — seed de 3 juegos nuevos (variedad por área).
-- Requiere 20260826b_add_game_kinds.sql aplicado (enum con los nuevos valores).
--
--   calculo_mental   → Cálculo, Velocidad de procesamiento
--   odd_one_out      → Atención, Funciones ejecutivas (razonamiento), Velocidad
--   figuras_iguales  → Habilidades visoespaciales, Atención
--
-- Cada dificultad con 5 subniveles ascendentes. Gradiente de tier: los dos
-- primeros en `free` (cuenta gratis), figuras en `esencial` (base). Ninguno
-- `visible_anonimo` → el anónimo sigue viendo pocos.
--
-- Backup: supabase/backups/20260826c_pre_more_games_seed.sql (borra las filas;
-- los valores del enum no se pueden quitar en Postgres, quedan inertes).
-- Idempotente: ON CONFLICT (slug) DO UPDATE.
-- ============================================================================

BEGIN;

INSERT INTO public.cognitive_exercises
  (slug, title, description, instructions, game_kind, domains, age_band, min_plan, visible_anonimo, config, status)
VALUES
  ('calculo-mental', 'Cálculo mental',
   'Resuelve operaciones sencillas antes de que acabe el tiempo.',
   'Verás una operación (suma, resta o multiplicación). Toca la respuesta correcta entre las opciones antes de que se agote el tiempo. Cada dificultad tiene 5 subniveles que suben poco a poco.',
   'calculo_mental', ARRAY['calculo','velocidad_procesamiento'], 'adultos', 'free', false,
   '{"levels":{"facil":[{"max":10,"mul":false,"ms":8000},{"max":15,"mul":false,"ms":7000},{"max":20,"mul":false,"ms":6500},{"max":25,"mul":false,"ms":6000},{"max":30,"mul":false,"ms":5500}],"medio":[{"max":20,"mul":false,"ms":5000},{"max":30,"mul":false,"ms":4800},{"max":12,"mul":true,"ms":6000},{"max":12,"mul":true,"ms":5200},{"max":15,"mul":true,"ms":5000}],"dificil":[{"max":15,"mul":true,"ms":4500},{"max":20,"mul":true,"ms":4200},{"max":25,"mul":true,"ms":3800},{"max":30,"mul":true,"ms":3400},{"max":40,"mul":true,"ms":3000}]}}'::jsonb,
   'publicado'),
  ('encuentra-el-diferente', 'Encuentra el diferente',
   'Entre muchas fichas iguales hay una distinta. Encuéntrala a tiempo.',
   'Se muestra una rejilla de fichas del mismo color con UNA de un tono diferente. Tócala antes de que se acabe el tiempo. Cada dificultad tiene 5 subniveles: crece la rejilla y baja el tiempo.',
   'odd_one_out', ARRAY['atencion_selectiva','razonamiento','velocidad_procesamiento'], 'adultos', 'free', false,
   '{"levels":{"facil":[{"cols":3,"ms":8000},{"cols":3,"ms":6500},{"cols":4,"ms":6000},{"cols":4,"ms":5000},{"cols":4,"ms":4200}],"medio":[{"cols":5,"ms":5000},{"cols":5,"ms":4200},{"cols":6,"ms":4000},{"cols":6,"ms":3400},{"cols":6,"ms":3000}],"dificil":[{"cols":7,"ms":3000},{"cols":7,"ms":2600},{"cols":8,"ms":2400},{"cols":8,"ms":2000},{"cols":8,"ms":1700}]}}'::jsonb,
   'publicado'),
  ('figuras-iguales', 'Figuras iguales',
   'Elige la figura idéntica al modelo: misma dirección y color.',
   'Arriba verás una figura modelo (una flecha con dirección y color). Entre las opciones, toca la que es exactamente igual. Cada dificultad tiene 5 subniveles con menos tiempo.',
   'figuras_iguales', ARRAY['visualizacion_espacial','atencion_selectiva'], 'adultos', 'esencial', false,
   '{"levels":{"facil":[{"ms":8000},{"ms":7000},{"ms":6000},{"ms":5200},{"ms":4600}],"medio":[{"ms":4200},{"ms":3800},{"ms":3400},{"ms":3000},{"ms":2700}],"dificil":[{"ms":2400},{"ms":2100},{"ms":1900},{"ms":1600},{"ms":1300}]}}'::jsonb,
   'publicado')
ON CONFLICT (slug) DO UPDATE SET
  title=EXCLUDED.title, description=EXCLUDED.description, instructions=EXCLUDED.instructions,
  game_kind=EXCLUDED.game_kind, domains=EXCLUDED.domains, age_band=EXCLUDED.age_band,
  min_plan=EXCLUDED.min_plan, visible_anonimo=EXCLUDED.visible_anonimo, config=EXCLUDED.config,
  status=EXCLUDED.status, updated_at=now();

COMMIT;

SELECT
  (SELECT count(*) FROM public.cognitive_exercises WHERE status='publicado') AS publicados,
  (SELECT string_agg(slug, ', ' ORDER BY slug) FROM public.cognitive_exercises WHERE game_kind IN ('calculo_mental','odd_one_out','figuras_iguales')) AS nuevos;
