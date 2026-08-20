-- ============================================================================
-- ⚠️  NO APLICADA. Requiere tu aprobación: toca `enforce_appointment_rules`.
--
-- El sprint dice "NO relajar triggers" y también "detenerse e informar" si algo
-- exige cambiar las invariantes. Esto es exactamente ese caso, así que el
-- archivo queda escrito y sin ejecutar.
--
-- ── Por qué hace falta ──────────────────────────────────────────────────────
--
-- La Fase 4 pide que el paciente pueda ACEPTAR la contraoferta, y que aceptar
-- confirme la cita. Hoy el trigger dice:
--
--     IF quien = OLD.patient_id THEN
--       IF NEW.status <> 'cancelled' THEN
--         RAISE EXCEPTION 'APPOINTMENT_PATIENT_CAN_ONLY_CANCEL: ...'
--
-- Verificado contra la base, como `authenticated`, con la contraoferta ya
-- creada: el paciente recibe APPOINTMENT_PATIENT_CAN_ONLY_CANCEL. No hay rodeo
-- posible desde el cliente ni desde una función SECURITY DEFINER: `auth.uid()`
-- sigue siendo el paciente y la regla se aplica igual. La única alternativa
-- sería falsificar el rol a `service_role` dentro de una función, que es un
-- bypass y no una solución.
--
-- ── Por qué esa regla existía ───────────────────────────────────────────────
--
-- Hasta ahora SOLO el paciente proponía. "El paciente solo puede cancelar" era
-- la forma corta de decir "quien propone no se confirma a sí mismo". Con la
-- contraoferta esa premisa deja de valer: ahora también propone el profesional,
-- y alguien tiene que poder aceptar lo propuesto.
--
-- ── Qué cambia exactamente ──────────────────────────────────────────────────
--
-- Se añade UNA rama al caso del paciente. No se quita ninguna comprobación.
-- El paciente puede pasar a 'confirmed' solo si se cumple TODO:
--
--   · la cita está en 'requested'
--   · la creó el profesional (`created_by = therapist_id`)
--   · es una contraoferta (`replaces_appointment_id IS NOT NULL`)
--
-- Es decir: el paciente puede aceptar lo que el profesional le propuso, y nada
-- más. No puede confirmarse una cita que pidió él, ni completar, ni marcar
-- no_show, ni reabrir nada cerrado.
--
-- ── Qué NO cambia ──────────────────────────────────────────────────────────
--
-- `starts_at` y `ends_at` siguen siendo inmutables. Las dos EXCLUDE siguen
-- iguales. El DELETE sigue prohibido. `OLD.status IN ('completed','cancelled',
-- 'no_show')` sigue cerrando la cita. Las facultades del profesional no se
-- tocan. `materialize_session_on_confirm` creará la sesión clínica igual que
-- cuando confirma el profesional, porque solo mira la transición.
--
-- Se corrige además el texto del aviso: hoy, al llegar una contraoferta, el
-- paciente recibe "Nueva cita solicitada / Revisa la agenda para confirmarla",
-- que describe lo que ve el profesional, no lo que ve él.
--
-- ── Cómo revertir ───────────────────────────────────────────────────────────
--
-- Volver a aplicar la definición anterior de `enforce_appointment_rules`, que
-- está íntegra en el historial de este repositorio.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enforce_appointment_rules()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  quien uuid := auth.uid();
  rol   text := coalesce(current_setting('request.jwt.claims', true)::json->>'role', '');
  es_sistema boolean := (rol = 'service_role') OR (quien IS NULL AND rol = '');
  rel record;
  perfil record;
  prefs record;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT * INTO rel FROM patient_therapist WHERE id = NEW.relationship_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'APPOINTMENT_NO_RELATIONSHIP: esa relación no existe.';
    END IF;
    IF rel.status <> 'active' THEN
      RAISE EXCEPTION 'APPOINTMENT_RELATIONSHIP_INACTIVE: no hay un proceso activo con este profesional.';
    END IF;

    -- Derivados: no se aceptan de fuera.
    NEW.patient_id   := rel.patient_id;
    NEW.therapist_id := rel.therapist_id;
    IF NOT es_sistema THEN
      NEW.created_by := quien;
    END IF;

    IF NOT es_sistema AND quien IS DISTINCT FROM rel.patient_id AND quien IS DISTINCT FROM rel.therapist_id THEN
      RAISE EXCEPTION 'APPOINTMENT_FORBIDDEN: esta relación no es tuya.';
    END IF;

    IF NEW.starts_at <= now() THEN
      RAISE EXCEPTION 'APPOINTMENT_IN_THE_PAST: no se puede agendar hacia atrás.';
    END IF;

    -- Franja y modalidad, contra lo que el profesional declaró.
    SELECT * INTO perfil FROM therapist_profiles WHERE profile_id = rel.therapist_id;
    IF FOUND AND array_length(perfil.availability, 1) IS NOT NULL
       AND NOT (franja_de(NEW.starts_at) = ANY (perfil.availability)) THEN
      RAISE EXCEPTION 'APPOINTMENT_SLOT_UNAVAILABLE: el profesional no atiende en esa franja.';
    END IF;

    SELECT * INTO prefs FROM user_preferences WHERE profile_id = rel.patient_id;
    IF FOUND AND perfil.profile_id IS NOT NULL
       AND array_length(prefs.modalities, 1) IS NOT NULL
       AND array_length(perfil.modalities, 1) IS NOT NULL
       AND NOT (prefs.modalities && perfil.modalities) THEN
      RAISE EXCEPTION 'APPOINTMENT_MODALITY_MISMATCH: no coincide la modalidad de atención.';
    END IF;

    NEW.status := coalesce(NEW.status, 'requested');
    RETURN NEW;
  END IF;

  -- ── UPDATE ────────────────────────────────────────────────────────────────
  IF NEW.relationship_id IS DISTINCT FROM OLD.relationship_id
     OR NEW.patient_id IS DISTINCT FROM OLD.patient_id
     OR NEW.therapist_id IS DISTINCT FROM OLD.therapist_id
     OR NEW.starts_at IS DISTINCT FROM OLD.starts_at
     OR NEW.ends_at IS DISTINCT FROM OLD.ends_at
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'APPOINTMENT_IMMUTABLE: para cambiar la hora se cancela y se pide otra.';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- Lo terminado no se reabre. Una cita completada es un hecho clínico.
    IF OLD.status IN ('completed', 'cancelled', 'no_show') THEN
      RAISE EXCEPTION 'APPOINTMENT_CLOSED: esta cita ya está cerrada.';
    END IF;

    IF NOT es_sistema THEN
      IF quien = OLD.patient_id THEN
        -- El paciente puede echarse atrás siempre…
        IF NEW.status = 'cancelled' THEN
          NULL;
        -- …y aceptar lo que el profesional le propuso. Solo eso: tiene que ser
        -- una contraoferta, creada por el profesional, todavía sin responder.
        ELSIF NEW.status = 'confirmed'
              AND OLD.status = 'requested'
              AND OLD.created_by = OLD.therapist_id
              AND OLD.replaces_appointment_id IS NOT NULL THEN
          NULL;
        ELSE
          RAISE EXCEPTION 'APPOINTMENT_PATIENT_CAN_ONLY_CANCEL: solo puedes cancelar tu cita o aceptar el horario que te proponen.';
        END IF;
      ELSIF quien = OLD.therapist_id THEN
        IF NEW.status NOT IN ('confirmed', 'cancelled', 'completed', 'no_show') THEN
          RAISE EXCEPTION 'APPOINTMENT_INVALID_TRANSITION: transición no permitida.';
        END IF;
        IF NEW.status = 'completed' AND OLD.status <> 'confirmed' THEN
          RAISE EXCEPTION 'APPOINTMENT_INVALID_TRANSITION: solo se completa una cita confirmada.';
        END IF;
      ELSE
        RAISE EXCEPTION 'APPOINTMENT_FORBIDDEN: esta cita no es tuya.';
      END IF;
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END
$$;

-- ── El aviso, contado desde el lado de quien lo recibe ──────────────────────
CREATE OR REPLACE FUNCTION public.notify_appointment()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.replaces_appointment_id IS NOT NULL AND NEW.created_by = NEW.therapist_id THEN
      PERFORM push_notification(NEW.patient_id, 'APPOINTMENT_COUNTER_OFFERED',
        'Te proponen otro horario',
        'Tu profesional propuso una hora distinta para tu cita.',
        'cita', NEW.id::text, NEW.relationship_id);
      RETURN NEW;
    END IF;

    -- Avisa a la otra parte, nunca a quien la pidió.
    PERFORM push_notification(
      CASE WHEN NEW.created_by = NEW.patient_id THEN NEW.therapist_id ELSE NEW.patient_id END,
      'APPOINTMENT_REQUESTED', 'Nueva cita solicitada',
      'Revisa la agenda para confirmarla.', 'cita', NEW.id::text, NEW.relationship_id);
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'confirmed' THEN
      -- Confirmar puede venir ahora de cualquiera de los dos: se avisa al otro.
      PERFORM push_notification(
        CASE WHEN auth.uid() = NEW.patient_id THEN NEW.therapist_id ELSE NEW.patient_id END,
        'APPOINTMENT_CONFIRMED', 'La cita quedó confirmada', NULL,
        'cita', NEW.id::text, NEW.relationship_id);
    ELSIF NEW.status = 'cancelled' THEN
      PERFORM push_notification(
        CASE WHEN auth.uid() = NEW.patient_id THEN NEW.therapist_id ELSE NEW.patient_id END,
        'APPOINTMENT_CANCELLED', 'Una cita fue cancelada', NULL,
        'cita', NEW.id::text, NEW.relationship_id);
    ELSIF NEW.status = 'completed' THEN
      PERFORM push_notification(NEW.patient_id, 'APPOINTMENT_COMPLETED',
        'Tu cita quedó registrada', NULL, 'cita', NEW.id::text, NEW.relationship_id);
    END IF;
  END IF;
  RETURN NEW;
END
$$;
