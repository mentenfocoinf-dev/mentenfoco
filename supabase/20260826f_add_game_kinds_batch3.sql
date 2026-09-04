-- ============================================================================
-- Rehabilitación cognitiva — nuevos tipos de minijuego (lote 3).
-- Cierra el objetivo de ≥2 juegos por área: faltaban Orientación y Cognición
-- social. ADD VALUE debe commitearse antes del seed (20260826g). IF NOT EXISTS
-- → idempotente. Los valores del enum no se pueden eliminar en Postgres.
--
--   dia_siguiente      → Orientación (temporal)
--   respuesta_adecuada → Cognición social
-- ============================================================================
ALTER TYPE public.exercise_game_kind ADD VALUE IF NOT EXISTS 'dia_siguiente';
ALTER TYPE public.exercise_game_kind ADD VALUE IF NOT EXISTS 'respuesta_adecuada';
