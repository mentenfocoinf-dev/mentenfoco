-- ============================================================================
-- Rehabilitación cognitiva — nuevos tipos de minijuego (lote 2, variedad ≥2/área).
--
-- ALTER TYPE ... ADD VALUE debe quedar commiteado antes de usarse en un INSERT
-- (por eso el seed va aparte, 20260826e). IF NOT EXISTS → idempotente. Los
-- valores de un enum NO se pueden eliminar en Postgres; el rollback del seed
-- quita las filas, pero estos valores quedan (inertes si no se usan).
--
--   cuenta_rapido      → Cálculo, Atención sostenida
--   patron_igual       → Habilidades visoespaciales, Atención selectiva
--   que_hora           → Orientación
--   emocion_situacion  → Cognición social, Comprensión
--   ordena_pasos       → Funciones ejecutivas (planificación), Comprensión
--   forma_palabra      → Lenguaje
-- ============================================================================
ALTER TYPE public.exercise_game_kind ADD VALUE IF NOT EXISTS 'cuenta_rapido';
ALTER TYPE public.exercise_game_kind ADD VALUE IF NOT EXISTS 'patron_igual';
ALTER TYPE public.exercise_game_kind ADD VALUE IF NOT EXISTS 'que_hora';
ALTER TYPE public.exercise_game_kind ADD VALUE IF NOT EXISTS 'emocion_situacion';
ALTER TYPE public.exercise_game_kind ADD VALUE IF NOT EXISTS 'ordena_pasos';
ALTER TYPE public.exercise_game_kind ADD VALUE IF NOT EXISTS 'forma_palabra';
