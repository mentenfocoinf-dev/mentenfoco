-- ============================================================================
-- Enunciado propio de cada instrumento.
--
-- Faltaba y no es cosmetico: "durante las ultimas 2 semanas, con que frecuencia
-- te ha molestado..." es el encabezado de PHQ-9 y GAD-7, y define la ventana
-- temporal que se esta midiendo. Rosenberg no pregunta por dos semanas, sino por
-- como te ves en general. Mostrar el encabezado equivocado cambia lo que la
-- persona responde y, con ello, el puntaje.
-- ============================================================================

ALTER TABLE public_tests
  ADD COLUMN IF NOT EXISTS instrucciones text;

UPDATE public_tests SET instrucciones = coalesce(instrucciones, '')
 WHERE instrucciones IS NULL;

ALTER TABLE public_tests
  ALTER COLUMN instrucciones SET DEFAULT '';
