-- ============================================================================
-- patient_therapist — la relación formal, con estado e historia.
--
-- ── Por qué esto NO crea una tabla ──────────────────────────────────────────
--
-- `patient_therapist` YA EXISTE, con 4 filas vivas y cinco consumidores en el
-- código (mensajería, consentimiento clínico, las dos escalas psicométricas y
-- la lista de pacientes del terapeuta). Crearla de nuevo habría exigido borrar
-- esas filas y romper esos cinco sitios; crear una segunda tabla con otro
-- nombre habría dejado dos fuentes de verdad sobre quién atiende a quién.
--
-- Así que se AMPLÍA: las tres columnas que ya había —patient_id, therapist_id,
-- created_at— se quedan intactas y con su significado, y encima se añade lo que
-- faltaba para que la asignación tenga estado e historia.
--
-- `therapist_id` es lo que la especificación llama `therapist_profile_id`: es el
-- id del perfil profesional, porque therapist_profiles.profile_id ES
-- profiles.id. No se duplica bajo otro nombre — dos columnas con el mismo dato
-- acaban discrepando. Sí se añade la FK contra therapist_profiles: sin perfil
-- profesional no hay matching, y por tanto no debería haber asignación.
--
-- ── Nada se borra ───────────────────────────────────────────────────────────
--
-- Terminar y cancelar son estados. Una relación clínica que existió y se cerró
-- es exactamente lo que hay que poder demostrar después; un DELETE la haría
-- desaparecer junto con el porqué. Un trigger lo bloquea.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'relationship_status') THEN
    CREATE TYPE public.relationship_status AS ENUM ('active', 'finished', 'cancelled');
  END IF;
END
$$;

-- ── Lo que faltaba ──────────────────────────────────────────────────────────
ALTER TABLE public.patient_therapist
  ADD COLUMN IF NOT EXISTS id uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS contact_request_id uuid
    REFERENCES public.therapist_contact_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status public.relationship_status NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS ended_at   timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Las asignaciones anteriores a este cambio son reales y siguen vigentes: se
-- dan por activas desde la fecha en que se crearon. No se inventa nada más.
UPDATE public.patient_therapist
SET assigned_at = coalesce(assigned_at, created_at),
    updated_at  = coalesce(updated_at, created_at)
WHERE assigned_at IS NULL OR updated_at IS NULL;

ALTER TABLE public.patient_therapist
  ALTER COLUMN assigned_at SET DEFAULT now(),
  ALTER COLUMN updated_at  SET DEFAULT now();

DO $$
BEGIN
  -- La PK sigue siendo (patient_id, therapist_id): cambiarla rompería las
  -- referencias que ya usan ese nombre. `id` es identificador estable aparte.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'patient_therapist_id_key') THEN
    ALTER TABLE public.patient_therapist ADD CONSTRAINT patient_therapist_id_key UNIQUE (id);
  END IF;

  -- Una relación nace de una solicitud aceptada, y de una sola.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'patient_therapist_contact_request_key') THEN
    ALTER TABLE public.patient_therapist
      ADD CONSTRAINT patient_therapist_contact_request_key UNIQUE (contact_request_id);
  END IF;

  -- Sin perfil profesional no hay a quién asignar. Las 4 filas existentes ya
  -- lo cumplen; se comprobó antes de añadirla.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'patient_therapist_perfil_fkey') THEN
    ALTER TABLE public.patient_therapist
      ADD CONSTRAINT patient_therapist_perfil_fkey
      FOREIGN KEY (therapist_id) REFERENCES public.therapist_profiles(profile_id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'patient_therapist_cierre_coherente') THEN
    ALTER TABLE public.patient_therapist
      ADD CONSTRAINT patient_therapist_cierre_coherente
      CHECK ((status = 'active' AND ended_at IS NULL) OR (status <> 'active' AND ended_at IS NOT NULL));
  END IF;
END
$$;

-- ── Una relación activa por paciente ────────────────────────────────────────
-- Parcial: cerradas puede haber tantas como haga falta, y eso es el historial.
CREATE UNIQUE INDEX IF NOT EXISTS idx_patient_therapist_una_activa
  ON public.patient_therapist (patient_id) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_patient_therapist_terapeuta
  ON public.patient_therapist (therapist_id, status, assigned_at DESC);
CREATE INDEX IF NOT EXISTS idx_patient_therapist_paciente
  ON public.patient_therapist (patient_id, status);

-- ── Reglas de la relación ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_patient_therapist_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  quien uuid := auth.uid();
  rol   text := coalesce(current_setting('request.jwt.claims', true)::json->>'role', '');
  es_sistema boolean := (rol = 'service_role') OR (quien IS NULL AND rol = '');
  es_admin boolean;
BEGIN
  SELECT p.role = 'admin' INTO es_admin FROM profiles p WHERE p.id = quien;
  es_admin := coalesce(es_admin, false);

  IF TG_OP = 'UPDATE' THEN
    IF NEW.patient_id IS DISTINCT FROM OLD.patient_id
       OR NEW.therapist_id IS DISTINCT FROM OLD.therapist_id
       OR NEW.contact_request_id IS DISTINCT FROM OLD.contact_request_id
       OR NEW.assigned_at IS DISTINCT FROM OLD.assigned_at THEN
      RAISE EXCEPTION 'RELATIONSHIP_IMMUTABLE: quién, con quién y desde cuándo no se reescriben.';
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF OLD.status <> 'active' THEN
        RAISE EXCEPTION 'RELATIONSHIP_CLOSED: esta relación ya está cerrada.';
      END IF;
      IF NEW.status NOT IN ('finished', 'cancelled') THEN
        RAISE EXCEPTION 'RELATIONSHIP_INVALID_TRANSITION: de activa solo se pasa a finalizada o cancelada.';
      END IF;
      -- Cerrarla pueden las dos partes, o el admin. Nadie más.
      IF NOT es_sistema AND NOT es_admin
         AND quien IS DISTINCT FROM OLD.patient_id
         AND quien IS DISTINCT FROM OLD.therapist_id THEN
        RAISE EXCEPTION 'RELATIONSHIP_FORBIDDEN: esta relación no es tuya.';
      END IF;
      NEW.ended_at := coalesce(NEW.ended_at, now());
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_patient_therapist_rules ON public.patient_therapist;
CREATE TRIGGER trg_patient_therapist_rules
  BEFORE INSERT OR UPDATE ON public.patient_therapist
  FOR EACH ROW EXECUTE FUNCTION public.enforce_patient_therapist_rules();

CREATE OR REPLACE FUNCTION public.enforce_patient_therapist_no_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'RELATIONSHIP_APPEND_ONLY: una relación se finaliza o se cancela, no se borra.';
END
$$;

DROP TRIGGER IF EXISTS trg_patient_therapist_no_delete ON public.patient_therapist;
CREATE TRIGGER trg_patient_therapist_no_delete
  BEFORE DELETE ON public.patient_therapist
  FOR EACH ROW EXECUTE FUNCTION public.enforce_patient_therapist_no_delete();

-- ── La automatización: aceptar una solicitud CREA la relación ───────────────
--
-- Vive aquí y no en React porque aceptar y asignar tienen que ser el mismo
-- hecho. Si lo hiciera el cliente, una pestaña cerrada a destiempo dejaría
-- solicitudes aceptadas sin relación, y nadie lo notaría hasta que un paciente
-- preguntara por qué no tiene terapeuta.
--
-- Si el paciente ya tiene una relación activa, el INSERT choca contra el índice
-- único parcial, la excepción sube y la transacción entera se deshace: la
-- solicitud NO queda aceptada. Bloquear es exactamente eso.
CREATE OR REPLACE FUNCTION public.create_relationship_on_accept()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'pending' AND NEW.status = 'accepted' THEN
    INSERT INTO patient_therapist (patient_id, therapist_id, contact_request_id, status, assigned_at)
    VALUES (NEW.patient_id, NEW.therapist_profile_id, NEW.id, 'active', now())
    -- La pareja ya existía de antes (asignación manual previa a este flujo):
    -- se reactiva en vez de duplicar.
    ON CONFLICT (patient_id, therapist_id) DO UPDATE
      SET status = 'active', ended_at = NULL,
          contact_request_id = EXCLUDED.contact_request_id,
          assigned_at = EXCLUDED.assigned_at
      WHERE patient_therapist.status <> 'active';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_create_relationship_on_accept ON public.therapist_contact_requests;
CREATE TRIGGER trg_create_relationship_on_accept
  AFTER UPDATE ON public.therapist_contact_requests
  FOR EACH ROW EXECUTE FUNCTION public.create_relationship_on_accept();

-- ── Lectura ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_therapist()
RETURNS TABLE (
  id uuid, therapist_profile_id uuid, therapist_name text,
  specializations public.theme_key[], status public.relationship_status,
  assigned_at timestamptz, ended_at timestamptz
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT r.id, r.therapist_id, t.professional_name, t.specializations,
         r.status, r.assigned_at, r.ended_at
  FROM patient_therapist r
  JOIN therapist_profiles t ON t.profile_id = r.therapist_id
  WHERE auth.uid() IS NOT NULL AND r.patient_id = auth.uid() AND r.status = 'active'
$$;

CREATE OR REPLACE FUNCTION public.get_my_patients()
RETURNS TABLE (
  id uuid, patient_id uuid, patient_name text,
  status public.relationship_status, assigned_at timestamptz, ended_at timestamptz
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT r.id, r.patient_id, p.full_name, r.status, r.assigned_at, r.ended_at
  FROM patient_therapist r
  JOIN profiles p ON p.id = r.patient_id
  WHERE auth.uid() IS NOT NULL
    AND (
      r.therapist_id = auth.uid()
      OR EXISTS (SELECT 1 FROM profiles a WHERE a.id = auth.uid() AND a.role = 'admin')
    )
  ORDER BY r.assigned_at DESC
$$;

CREATE OR REPLACE FUNCTION public.get_relationship(p_id uuid)
RETURNS TABLE (
  id uuid, patient_id uuid, therapist_profile_id uuid, contact_request_id uuid,
  status public.relationship_status, assigned_at timestamptz, ended_at timestamptz
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT r.id, r.patient_id, r.therapist_id, r.contact_request_id,
         r.status, r.assigned_at, r.ended_at
  FROM patient_therapist r
  WHERE r.id = p_id
    AND auth.uid() IS NOT NULL
    AND (
      r.patient_id = auth.uid()
      OR r.therapist_id = auth.uid()
      OR EXISTS (SELECT 1 FROM profiles a WHERE a.id = auth.uid() AND a.role = 'admin')
    )
$$;

REVOKE ALL ON FUNCTION public.get_my_therapist() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_patients() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_relationship(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_therapist() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_patients() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_relationship(uuid) TO authenticated;

-- NOTA DE SEGURIDAD PENDIENTE
-- `patient_therapist` conserva GRANT SELECT a anon y authenticated de antes de
-- este cambio: cualquiera puede leer quién atiende a quién. NO se revoca aquí
-- porque cinco consumidores fuera del alcance de este sprint consultan la tabla
-- directamente (messagesService, clinicalConsentService, clinicalService,
-- PsychometricScaleModal, CssrsModal) y quedarían rotos. Migrarlos a estas
-- funciones y ejecutar el REVOKE es lo que cierra el agujero.

-- ── Policies equivalentes, para cuando se active RLS ────────────────────────
-- ALTER TABLE public.patient_therapist ENABLE ROW LEVEL SECURITY;
--
-- CREATE POLICY "el paciente ve la suya"
--   ON public.patient_therapist FOR SELECT USING (patient_id = auth.uid());
-- CREATE POLICY "el terapeuta ve donde participa"
--   ON public.patient_therapist FOR SELECT USING (therapist_id = auth.uid());
-- CREATE POLICY "el admin ve todo"
--   ON public.patient_therapist FOR ALL
--   USING (EXISTS (SELECT 1 FROM profiles a WHERE a.id = auth.uid() AND a.role = 'admin'));
-- CREATE POLICY "las dos partes cierran la suya"
--   ON public.patient_therapist FOR UPDATE
--   USING (patient_id = auth.uid() OR therapist_id = auth.uid());
-- -- Sin policy de DELETE: nadie borra. Además del trigger.
