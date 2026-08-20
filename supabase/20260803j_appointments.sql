-- ============================================================================
-- appointments — la cita, colgada de la relación terapéutica.
--
-- ── Qué NO duplica ──────────────────────────────────────────────────────────
--
-- `relationship_id` es la referencia; `patient_id` y `therapist_id` NO se
-- capturan: los rellena el trigger desde la relación. Están porque las
-- restricciones de solapamiento y los índices los necesitan en la propia fila,
-- pero no son un dato que nadie pueda escribir ni contradecir.
--
-- ── Solapamientos ───────────────────────────────────────────────────────────
--
-- La comprobación es una restricción EXCLUDE de Postgres, no una consulta
-- previa en el servicio. Un `SELECT ... WHERE overlaps` seguido de un INSERT
-- tiene una ventana entre los dos en la que otra transacción mete la cita del
-- medio; la restricción no tiene ventana. Solo cuentan las citas vivas
-- —solicitada o confirmada—: una cancelada no bloquea el hueco.
--
-- ── Disponibilidad ──────────────────────────────────────────────────────────
--
-- Sin calendario propio: sale de `therapist_profiles`, que ya la declara. Se
-- valida la franja (mañanas/tardes/noches/fin de semana) y que paciente y
-- profesional compartan alguna modalidad. Lo que no esté declarado no se
-- valida — no se puede comprobar contra un dato que nadie dio.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_status') THEN
    CREATE TYPE public.appointment_status AS ENUM (
      'requested', 'confirmed', 'cancelled', 'completed', 'no_show'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.appointments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id uuid NOT NULL REFERENCES public.patient_therapist(id) ON DELETE CASCADE,

  -- Derivados de la relación por el trigger. Viven aquí porque las
  -- restricciones de solapamiento operan sobre la fila.
  patient_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  therapist_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  starts_at       timestamptz NOT NULL,
  ends_at         timestamptz NOT NULL,
  status          public.appointment_status NOT NULL DEFAULT 'requested',
  created_by      uuid NOT NULL REFERENCES public.profiles(id),
  notes           text CHECK (notes IS NULL OR length(notes) <= 1000),

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT appointments_intervalo_valido CHECK (ends_at > starts_at),
  CONSTRAINT appointments_duracion_razonable
    CHECK (ends_at - starts_at BETWEEN interval '15 minutes' AND interval '4 hours')
);

COMMENT ON TABLE public.appointments IS
  'Citas de una relación terapéutica. patient_id y therapist_id los deriva el trigger: no son un dato editable.';

-- ── Sin solapamientos, garantizado por la base ──────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_sin_solape_terapeuta') THEN
    ALTER TABLE public.appointments ADD CONSTRAINT appointments_sin_solape_terapeuta
      EXCLUDE USING gist (
        therapist_id WITH =,
        tstzrange(starts_at, ends_at) WITH &&
      ) WHERE (status IN ('requested', 'confirmed'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_sin_solape_paciente') THEN
    ALTER TABLE public.appointments ADD CONSTRAINT appointments_sin_solape_paciente
      EXCLUDE USING gist (
        patient_id WITH =,
        tstzrange(starts_at, ends_at) WITH &&
      ) WHERE (status IN ('requested', 'confirmed'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_appointments_paciente
  ON public.appointments (patient_id, starts_at DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_terapeuta
  ON public.appointments (therapist_id, status, starts_at);

-- ── Franja declarada por el profesional ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.franja_de(p_momento timestamptz)
RETURNS public.availability_slot
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    -- El fin de semana manda sobre la hora: quien no atiende sábados no
    -- atiende sábados por la mañana.
    WHEN extract(isodow FROM p_momento) >= 6 THEN 'fines_de_semana'::public.availability_slot
    WHEN extract(hour FROM p_momento) < 12   THEN 'mananas'::public.availability_slot
    WHEN extract(hour FROM p_momento) < 18   THEN 'tardes'::public.availability_slot
    ELSE 'noches'::public.availability_slot
  END
$$;

-- ── Propiedad, integridad y transiciones ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_appointment_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
        -- El paciente solicita y puede echarse atrás. Nada más.
        IF NEW.status <> 'cancelled' THEN
          RAISE EXCEPTION 'APPOINTMENT_PATIENT_CAN_ONLY_CANCEL: solo puedes cancelar tu cita.';
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

DROP TRIGGER IF EXISTS trg_appointment_rules ON public.appointments;
CREATE TRIGGER trg_appointment_rules
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_appointment_rules();

CREATE OR REPLACE FUNCTION public.enforce_appointment_no_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'APPOINTMENT_APPEND_ONLY: una cita se cancela, no se borra.';
END $$;

DROP TRIGGER IF EXISTS trg_appointment_no_delete ON public.appointments;
CREATE TRIGGER trg_appointment_no_delete
  BEFORE DELETE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_appointment_no_delete();

-- ── Notificaciones: se consume el motor existente ───────────────────────────
CREATE OR REPLACE FUNCTION public.notify_appointment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Avisa a la otra parte, nunca a quien la pidió.
    PERFORM push_notification(
      CASE WHEN NEW.created_by = NEW.patient_id THEN NEW.therapist_id ELSE NEW.patient_id END,
      'APPOINTMENT_REQUESTED', 'Nueva cita solicitada',
      'Revisa la agenda para confirmarla.', 'cita', NEW.id::text, NEW.relationship_id);
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'confirmed' THEN
      PERFORM push_notification(NEW.patient_id, 'APPOINTMENT_CONFIRMED',
        'Tu cita fue confirmada', NULL, 'cita', NEW.id::text, NEW.relationship_id);
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
END $$;

DROP TRIGGER IF EXISTS trg_notify_appointment ON public.appointments;
CREATE TRIGGER trg_notify_appointment
  AFTER INSERT OR UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.notify_appointment();

-- ── Lectura ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.list_my_appointments()
RETURNS TABLE (
  id uuid, relationship_id uuid, counterpart_name text,
  starts_at timestamptz, ends_at timestamptz,
  status public.appointment_status, notes text, created_by uuid
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT a.id, a.relationship_id, t.professional_name,
         a.starts_at, a.ends_at, a.status, a.notes, a.created_by
  FROM appointments a
  JOIN therapist_profiles t ON t.profile_id = a.therapist_id
  WHERE auth.uid() IS NOT NULL AND a.patient_id = auth.uid()
  ORDER BY a.starts_at DESC
$$;

CREATE OR REPLACE FUNCTION public.list_therapist_appointments()
RETURNS TABLE (
  id uuid, relationship_id uuid, counterpart_name text,
  starts_at timestamptz, ends_at timestamptz,
  status public.appointment_status, notes text, created_by uuid
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT a.id, a.relationship_id, p.full_name,
         a.starts_at, a.ends_at, a.status, a.notes, a.created_by
  FROM appointments a
  JOIN profiles p ON p.id = a.patient_id
  WHERE auth.uid() IS NOT NULL AND a.therapist_id = auth.uid()
  ORDER BY a.starts_at ASC
$$;

-- ── Permisos ────────────────────────────────────────────────────────────────
REVOKE ALL ON public.appointments FROM anon, authenticated;
GRANT INSERT, UPDATE ON public.appointments TO authenticated;

REVOKE ALL ON FUNCTION public.list_my_appointments() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_therapist_appointments() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_my_appointments() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_therapist_appointments() TO authenticated;

-- ── Policies equivalentes, para cuando se active RLS ────────────────────────
-- ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
--
-- CREATE POLICY "las dos partes ven sus citas"
--   ON public.appointments FOR SELECT
--   USING (patient_id = auth.uid() OR therapist_id = auth.uid());
-- CREATE POLICY "las dos partes crean en su relación"
--   ON public.appointments FOR INSERT
--   WITH CHECK (EXISTS (SELECT 1 FROM patient_therapist r
--                       WHERE r.id = relationship_id AND r.status = 'active'
--                         AND (r.patient_id = auth.uid() OR r.therapist_id = auth.uid())));
-- CREATE POLICY "las dos partes actualizan la suya"
--   ON public.appointments FOR UPDATE
--   USING (patient_id = auth.uid() OR therapist_id = auth.uid());
-- -- Sin policy de DELETE: nadie borra. Además del trigger.
