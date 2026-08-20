-- ============================================================================
-- therapist_contact_requests — la solicitud de contacto paciente → terapeuta.
--
-- Es el puente entre el Matching Engine y una conversación real: el motor dice
-- con quién encajas, esto es la persona pidiéndolo y el profesional aceptando.
-- Tabla propia porque no es ni identidad ni perfil profesional: es una relación
-- entre dos, con estado y con historia.
--
-- ── Nada se borra ───────────────────────────────────────────────────────────
--
-- Cancelar y rechazar son ESTADOS, no DELETE. Que alguien pidiera ayuda y
-- después se echara atrás es información que importa, y un rechazo borrado
-- deja al paciente pudiendo insistir sin que quede rastro. Un trigger bloquea
-- el DELETE para que no dependa de que nadie se equivoque.
--
-- ── Seguridad, con RLS desactivado ──────────────────────────────────────────
--
-- Con RLS apagado una policy no se ejecuta, así que las reglas van en TRIGGER,
-- y la lectura por funciones SECURITY DEFINER. No se concede SELECT a nadie:
-- quién pidió hablar con qué psicólogo es información de salud de facto.
--
-- Las reglas, y ninguna más:
--   paciente   crea la suya (siempre 'pending') y puede cancelarla.
--   terapeuta  acepta o rechaza las dirigidas a él.
--   nadie      edita las de otros, cambia el mensaje, ni reabre lo cerrado.
--
-- Las policies equivalentes quedan escritas y comentadas al final.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contact_request_status') THEN
    CREATE TYPE public.contact_request_status AS ENUM (
      'pending',
      'accepted',
      'rejected',
      'cancelled'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.therapist_contact_requests (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  patient_id           uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Apunta al PERFIL profesional, no a profiles: sin perfil no hay matching y
  -- por tanto no hay a quién solicitar.
  therapist_profile_id uuid NOT NULL
                         REFERENCES public.therapist_profiles(profile_id) ON DELETE CASCADE,

  status               public.contact_request_status NOT NULL DEFAULT 'pending',
  -- Lo que la persona quiera contar al pedir la cita. Opcional y acotado: no es
  -- una historia clínica, es una presentación.
  message              text CHECK (message IS NULL OR length(message) <= 1000),

  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),

  -- Nadie se solicita a sí mismo.
  CONSTRAINT therapist_contact_requests_no_autosolicitud
    CHECK (patient_id <> therapist_profile_id)
);

COMMENT ON TABLE public.therapist_contact_requests IS
  'Solicitud de contacto de un paciente a un terapeuta. Cancelar y rechazar son estados: nada se borra.';

-- Una sola solicitud ABIERTA por pareja. Cerrada —rechazada o cancelada— se
-- puede volver a pedir: las circunstancias cambian.
CREATE UNIQUE INDEX IF NOT EXISTS idx_contact_requests_una_pendiente
  ON public.therapist_contact_requests (patient_id, therapist_profile_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_contact_requests_paciente
  ON public.therapist_contact_requests (patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_requests_terapeuta
  ON public.therapist_contact_requests (therapist_profile_id, status, created_at DESC);

-- ── Quién puede hacer qué, y qué transiciones existen ───────────────────────
CREATE OR REPLACE FUNCTION public.enforce_contact_request_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  quien uuid := auth.uid();
  rol   text := coalesce(current_setting('request.jwt.claims', true)::json->>'role', '');
  es_sistema boolean := (rol = 'service_role') OR (quien IS NULL AND rol = '');
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Solo se crean solicitudes propias, y siempre abiertas. Crear una ya
    -- aceptada sería aceptarse a sí mismo.
    IF NOT es_sistema AND NEW.patient_id IS DISTINCT FROM quien THEN
      RAISE EXCEPTION 'CONTACT_REQUEST_FORBIDDEN: solo puedes crear solicitudes a tu nombre.';
    END IF;
    IF NEW.status <> 'pending' THEN
      RAISE EXCEPTION 'CONTACT_REQUEST_INVALID_INITIAL_STATUS: una solicitud nace pendiente.';
    END IF;
    RETURN NEW;
  END IF;

  -- ── UPDATE ────────────────────────────────────────────────────────────────
  -- Lo que nunca cambia: de quién es, a quién va, cuándo se creó y qué decía.
  IF NEW.patient_id IS DISTINCT FROM OLD.patient_id
     OR NEW.therapist_profile_id IS DISTINCT FROM OLD.therapist_profile_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.message IS DISTINCT FROM OLD.message THEN
    RAISE EXCEPTION 'CONTACT_REQUEST_IMMUTABLE: una solicitud enviada no se reescribe.';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- Lo cerrado está cerrado. Para volver a intentarlo se crea otra.
    IF OLD.status <> 'pending' THEN
      RAISE EXCEPTION 'CONTACT_REQUEST_CLOSED: esta solicitud ya fue resuelta.';
    END IF;

    IF NOT es_sistema THEN
      IF quien = OLD.patient_id THEN
        IF NEW.status <> 'cancelled' THEN
          RAISE EXCEPTION 'CONTACT_REQUEST_PATIENT_CAN_ONLY_CANCEL: solo puedes cancelar tu solicitud.';
        END IF;
      ELSIF quien = OLD.therapist_profile_id THEN
        IF NEW.status NOT IN ('accepted', 'rejected') THEN
          RAISE EXCEPTION 'CONTACT_REQUEST_THERAPIST_CAN_ONLY_RESOLVE: solo puedes aceptar o rechazar.';
        END IF;
      ELSE
        RAISE EXCEPTION 'CONTACT_REQUEST_FORBIDDEN: esta solicitud no es tuya.';
      END IF;
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_contact_request_rules ON public.therapist_contact_requests;
CREATE TRIGGER trg_contact_request_rules
  BEFORE INSERT OR UPDATE ON public.therapist_contact_requests
  FOR EACH ROW EXECUTE FUNCTION public.enforce_contact_request_rules();

-- ── Nada se borra ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_contact_request_no_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'CONTACT_REQUEST_APPEND_ONLY: una solicitud se cancela o se rechaza, no se borra.';
END
$$;

DROP TRIGGER IF EXISTS trg_contact_request_no_delete ON public.therapist_contact_requests;
CREATE TRIGGER trg_contact_request_no_delete
  BEFORE DELETE ON public.therapist_contact_requests
  FOR EACH ROW EXECUTE FUNCTION public.enforce_contact_request_no_delete();

-- ── Lectura: solo lo tuyo, y solo por función ───────────────────────────────
-- Se devuelve el nombre de la otra parte junto a la solicitud para no obligar a
-- una segunda consulta que tendría que abrir más de lo necesario.

CREATE OR REPLACE FUNCTION public.list_my_contact_requests()
RETURNS TABLE (
  id uuid, therapist_profile_id uuid, therapist_name text,
  status public.contact_request_status, message text,
  created_at timestamptz, updated_at timestamptz
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT r.id, r.therapist_profile_id, t.professional_name,
         r.status, r.message, r.created_at, r.updated_at
  FROM therapist_contact_requests r
  JOIN therapist_profiles t ON t.profile_id = r.therapist_profile_id
  WHERE auth.uid() IS NOT NULL AND r.patient_id = auth.uid()
  ORDER BY r.created_at DESC
$$;

CREATE OR REPLACE FUNCTION public.list_received_contact_requests()
RETURNS TABLE (
  id uuid, patient_id uuid, patient_name text,
  status public.contact_request_status, message text,
  created_at timestamptz, updated_at timestamptz
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT r.id, r.patient_id, p.full_name,
         r.status, r.message, r.created_at, r.updated_at
  FROM therapist_contact_requests r
  JOIN profiles p ON p.id = r.patient_id
  WHERE auth.uid() IS NOT NULL AND r.therapist_profile_id = auth.uid()
  ORDER BY r.created_at DESC
$$;

/** Una solicitud concreta, si quien pregunta es una de las dos partes. */
CREATE OR REPLACE FUNCTION public.get_contact_request(p_id uuid)
RETURNS TABLE (
  id uuid, patient_id uuid, therapist_profile_id uuid,
  status public.contact_request_status, message text,
  created_at timestamptz, updated_at timestamptz
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT r.id, r.patient_id, r.therapist_profile_id,
         r.status, r.message, r.created_at, r.updated_at
  FROM therapist_contact_requests r
  WHERE r.id = p_id
    AND auth.uid() IS NOT NULL
    AND (r.patient_id = auth.uid() OR r.therapist_profile_id = auth.uid())
$$;

COMMENT ON FUNCTION public.list_my_contact_requests() IS
  'Solicitudes enviadas por quien llama. Filtra por auth.uid() internamente.';
COMMENT ON FUNCTION public.list_received_contact_requests() IS
  'Solicitudes dirigidas a quien llama. Filtra por auth.uid() internamente.';

-- ── Permisos ────────────────────────────────────────────────────────────────
-- Sin SELECT: quién pidió hablar con qué psicólogo no es un dato público.
REVOKE ALL ON public.therapist_contact_requests FROM anon, authenticated;
GRANT INSERT, UPDATE ON public.therapist_contact_requests TO authenticated;

REVOKE ALL ON FUNCTION public.list_my_contact_requests() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_received_contact_requests() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_contact_request(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_my_contact_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_received_contact_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_contact_request(uuid) TO authenticated;

-- ── Policies equivalentes, para cuando se active RLS ────────────────────────
-- ALTER TABLE public.therapist_contact_requests ENABLE ROW LEVEL SECURITY;
--
-- CREATE POLICY "el paciente ve las suyas"
--   ON public.therapist_contact_requests FOR SELECT USING (patient_id = auth.uid());
-- CREATE POLICY "el terapeuta ve las dirigidas a él"
--   ON public.therapist_contact_requests FOR SELECT USING (therapist_profile_id = auth.uid());
-- CREATE POLICY "el paciente crea las suyas"
--   ON public.therapist_contact_requests FOR INSERT WITH CHECK (patient_id = auth.uid());
-- CREATE POLICY "las dos partes actualizan la suya"
--   ON public.therapist_contact_requests FOR UPDATE
--   USING (patient_id = auth.uid() OR therapist_profile_id = auth.uid());
-- -- Sin policy de DELETE: nadie borra. Además del trigger.
