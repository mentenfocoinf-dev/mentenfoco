-- ============================================================================
-- Las citas empiezan en punto y duran exactamente una hora.
--
-- ── La regla de negocio ─────────────────────────────────────────────────────
--
-- Cada cita ocupa una hora: 45 minutos de consulta y 15 para dejar escrita la
-- evolución. Ese cuarto de hora es parte del trabajo clínico, no holgura, así
-- que no se negocia ni se recorta. En consecuencia, si hay una cita a las 09:00
-- el siguiente hueco es a las 10:00.
--
-- El formulario ya solo ofrece horas en punto, pero un formulario es una
-- sugerencia: cualquiera puede llamar a la API con 09:37. La regla vive aquí.
--
-- ── Por qué NOT VALID ───────────────────────────────────────────────────────
--
-- Hay una solicitud real ya guardada, creada con el formulario anterior, que
-- dura 50 minutos. `NOT VALID` aplica la restricción a todo lo que entre a
-- partir de ahora sin tocar lo que ya existe: no se reescribe una solicitud que
-- una persona hizo de verdad. Cuando esa cita se resuelva, se puede validar la
-- restricción con `VALIDATE CONSTRAINT`.
--
-- El solapamiento NO se toca: ya lo impiden las restricciones EXCLUDE y la
-- comprobación cruzada con `therapy_sessions`, que siguen igual.
-- ============================================================================

DO $$
BEGIN
  -- Inicio en punto: sin minutos, segundos ni fracciones. `date_trunc` opera
  -- sobre el instante, así que es correcto en cualquier huso horario.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_empieza_en_punto') THEN
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_empieza_en_punto
      CHECK (starts_at = date_trunc('hour', starts_at)) NOT VALID;
  END IF;

  -- Duración fija.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_dura_una_hora') THEN
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_dura_una_hora
      CHECK (ends_at - starts_at = interval '1 hour') NOT VALID;
  END IF;
END
$$;

COMMENT ON CONSTRAINT appointments_dura_una_hora ON public.appointments IS
  'Una hora: 45 min de consulta + 15 de evolución. No configurable.';
