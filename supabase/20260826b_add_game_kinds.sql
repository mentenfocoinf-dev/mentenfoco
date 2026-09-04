-- ============================================================================
-- Rehabilitación cognitiva — nuevos tipos de minijuego (variedad por área).
--
-- ALTER TYPE ... ADD VALUE debe ejecutarse FUERA de una transacción y quedar
-- commiteado antes de poder usarse en un INSERT (de ahí que el seed vaya en un
-- archivo aparte, 20260826c). IF NOT EXISTS → idempotente. NOTA: los valores de
-- un enum NO se pueden eliminar en Postgres; el rollback del seed quita las
-- filas, pero estos valores quedan (inertes si no se usan).
-- ============================================================================
ALTER TYPE public.exercise_game_kind ADD VALUE IF NOT EXISTS 'calculo_mental';
ALTER TYPE public.exercise_game_kind ADD VALUE IF NOT EXISTS 'odd_one_out';
ALTER TYPE public.exercise_game_kind ADD VALUE IF NOT EXISTS 'figuras_iguales';
