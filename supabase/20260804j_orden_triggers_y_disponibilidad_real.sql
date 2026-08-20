-- ============================================================================
-- 1. La comprobación de solapamiento no se estaba ejecutando nunca.
-- 2. Frontend y backend deben ofrecer y aceptar exactamente lo mismo.
--
-- ── El bug, y por qué es grave ──────────────────────────────────────────────
--
-- PostgreSQL dispara los triggers BEFORE por ORDEN ALFABÉTICO de nombre. En
-- `appointments` el orden real era:
--
--     trg_appointment_agenda -> trg_appointment_chain
--       -> trg_appointment_no_delete -> trg_appointment_rules
--
-- `trg_appointment_rules` es quien deriva `NEW.patient_id` y `NEW.therapist_id`
-- desde la relación, y va EL ÚLTIMO. El cliente no envía esas dos columnas —no
-- debe—, así que cuando `trg_appointment_agenda` llamaba a
-- `agenda_hay_conflicto()` lo hacía con las dos en NULL. Y con NULL esa función
-- no encuentra nada nunca: `s.therapist_id = NULL` no es verdadero, es NULL.
--
-- Consecuencia: `AGENDA_CONFLICT` no se levantó jamás en un INSERT. Lo único
-- que protegía eran las dos EXCLUDE, que solo miran `appointments` contra
-- `appointments`. Una cita PODÍA agendarse encima de una sesión clínica.
--
-- Demostrado, no supuesto (rollback forzado, rol authenticated):
--
--     agenda_hay_conflicto con ids correctos: true
--     agenda_hay_conflicto con ids NULL:      false
--     INSERT de cita sobre una sesión:        ENTRO
--
-- ── La corrección, lo más pequeña posible ───────────────────────────────────
--
-- No se toca ninguna función. No cambia ninguna regla de negocio. Solo se
-- renombra el trigger para que ordene DESPUÉS de `trg_appointment_rules`, que
-- es exactamente lo que pedía el enunciado: garantizar que `patient_id` y
-- `therapist_id` estén inicializados antes de comprobar el conflicto.
--
--     ... -> trg_appointment_rules -> trg_appointment_zz_agenda
--
-- El prefijo `zz_` no es decorativo: es el mecanismo. Cualquiera que añada un
-- trigger nuevo debe saber que este va el último a propósito.
--
-- ── Disponibilidad: que las dos partes digan lo mismo ───────────────────────
--
-- Con el bug arreglado, el INSERT comprueba: relación activa, no en el pasado,
-- franja declarada, modalidad compatible y solapamiento. `available_hours`
-- comprobaba todo eso MENOS la modalidad. Es decir, podía ofrecer horas que el
-- servidor iba a rechazar con APPOINTMENT_MODALITY_MISMATCH.
--
-- Hoy no hay ninguna relación activa con modalidades incompatibles (medido: 0
-- de 4), así que nadie lo ha sufrido todavía. Se cierra igual: la garantía que
-- se pide es que frontend y backend devuelvan la MISMA disponibilidad, y eso no
-- puede depender de que los datos actuales no toquen el caso.
-- ============================================================================

-- ── 1. El orden ─────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_appointment_agenda ON public.appointments;
DROP TRIGGER IF EXISTS trg_appointment_zz_agenda ON public.appointments;

CREATE TRIGGER trg_appointment_zz_agenda
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_appointment_agenda();

COMMENT ON TRIGGER trg_appointment_zz_agenda ON public.appointments IS
  'Va el ÚLTIMO a propósito: necesita patient_id y therapist_id ya derivados por trg_appointment_rules. Los triggers BEFORE se disparan por orden alfabético.';

-- ── 2. La misma disponibilidad a los dos lados ──────────────────────────────
CREATE OR REPLACE FUNCTION public.available_hours(
  p_relationship_id uuid,
  p_desde_instante timestamptz,
  p_hasta_instante timestamptz
)
RETURNS TABLE (hora timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE
AS $$
DECLARE
  rel    record;
  perfil record;
  prefs  record;
BEGIN
  IF p_desde_instante IS NULL OR p_hasta_instante IS NULL
     OR p_hasta_instante <= p_desde_instante
     OR p_hasta_instante > p_desde_instante + interval '48 hours' THEN
    RETURN;
  END IF;

  SELECT * INTO rel FROM patient_therapist WHERE id = p_relationship_id;
  IF NOT FOUND OR rel.status <> 'active' THEN RETURN; END IF;

  IF auth.uid() IS NULL
     OR (auth.uid() <> rel.patient_id AND auth.uid() <> rel.therapist_id) THEN
    RETURN;
  END IF;

  SELECT * INTO perfil FROM therapist_profiles WHERE profile_id = rel.therapist_id;
  SELECT * INTO prefs  FROM user_preferences  WHERE profile_id = rel.patient_id;

  -- Misma comprobación de modalidad que hace el trigger al insertar. Si no
  -- coinciden, NINGUNA hora es pedible: ofrecer alguna sería mentir.
  IF perfil.profile_id IS NOT NULL
     AND prefs.profile_id IS NOT NULL
     AND array_length(prefs.modalities, 1) IS NOT NULL
     AND array_length(perfil.modalities, 1) IS NOT NULL
     AND NOT (prefs.modalities && perfil.modalities) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT h
  FROM generate_series(p_desde_instante, p_hasta_instante, interval '1 hour') AS h
  WHERE h > now()
    -- Horario laboral (aproximado por ahora con la franja declarada).
    AND (perfil.profile_id IS NULL
         OR array_length(perfil.availability, 1) IS NULL
         OR franja_de(h) = ANY (perfil.availability))
    -- Sesiones + solicitudes vivas + bloqueos manuales.
    AND NOT hora_ocupada(rel.therapist_id, rel.patient_id, h, h + interval '1 hour')
  ORDER BY h;
END
$$;

COMMENT ON FUNCTION public.available_hours(uuid, timestamptz, timestamptz) IS
  'Horas libres entre dos instantes. Aplica las MISMAS comprobaciones que el trigger de INSERT: relación activa, futuro, franja, modalidad y solapamiento. Si el servidor la ofrece, el servidor la acepta.';
