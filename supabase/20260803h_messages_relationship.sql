-- ============================================================================
-- messages — la conversación, atada a la relación formal.
--
-- ── Por qué esto NO crea una tabla ──────────────────────────────────────────
--
-- `messages` YA EXISTE (migración 20260717) con id, patient_id, therapist_id,
-- sender_id, body, read_at y created_at, y con cinco componentes usándola. Está
-- vacía, así que no hay historial que perder, pero recrearla habría roto la
-- mensajería que ya funciona sin ganar nada.
--
-- Lo que le faltaba era el vínculo con `patient_therapist`: hasta ahora la
-- conversación era el PAR (paciente, terapeuta), y una relación cerrada y otra
-- nueva con el mismo profesional compartirían hilo. Con `relationship_id` cada
-- proceso tiene su conversación.
--
-- `body` es el `message` de la especificación. No se duplica bajo otro nombre.
--
-- ── El par y la relación se mantienen solos ─────────────────────────────────
--
-- El trigger rellena lo que falte en cualquiera de las dos direcciones: quien
-- inserte con relationship_id recibe patient_id/therapist_id derivados, y quien
-- inserte con el par recibe el relationship_id de su relación ACTIVA. Así el
-- código nuevo y el que ya existía escriben en la misma tabla sin pisarse y sin
-- que puedan discrepar.
--
-- ── Reglas ──────────────────────────────────────────────────────────────────
--
--   · `sender_id` SIEMPRE sale de auth.uid(). Lo que mande el cliente se ignora.
--   · Solo escriben las dos partes de la relación, y solo si está activa.
--   · Un mensaje enviado no se edita: del UPDATE solo pasa `read_at`.
--   · Nada se borra.
-- ============================================================================

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS relationship_id uuid REFERENCES public.patient_therapist(id),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_messages_relacion
  ON public.messages (relationship_id, created_at);
-- Para el contador de no leídos, que pregunta justo por esto.
CREATE INDEX IF NOT EXISTS idx_messages_sin_leer
  ON public.messages (relationship_id, sender_id) WHERE read_at IS NULL;

-- ── Alta ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_message_insert()
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
BEGIN
  -- El remitente NO se acepta desde fuera: es quien tiene la sesión. Sin esto,
  -- cualquiera podría escribir un mensaje firmado por otra persona.
  IF NOT es_sistema THEN
    NEW.sender_id := quien;
  END IF;

  IF NEW.relationship_id IS NOT NULL THEN
    SELECT * INTO rel FROM patient_therapist WHERE id = NEW.relationship_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'MESSAGE_NO_RELATIONSHIP: esa conversación no existe.';
    END IF;
    NEW.patient_id   := rel.patient_id;
    NEW.therapist_id := rel.therapist_id;
  ELSE
    -- Camino heredado: llega el par y se busca su relación activa.
    SELECT * INTO rel FROM patient_therapist
    WHERE patient_id = NEW.patient_id AND therapist_id = NEW.therapist_id AND status = 'active';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'MESSAGE_NO_RELATIONSHIP: no hay una relación activa entre estas dos personas.';
    END IF;
    NEW.relationship_id := rel.id;
  END IF;

  IF rel.status <> 'active' THEN
    RAISE EXCEPTION 'MESSAGE_RELATIONSHIP_CLOSED: esta conversación está cerrada.';
  END IF;

  IF NOT es_sistema AND NEW.sender_id <> rel.patient_id AND NEW.sender_id <> rel.therapist_id THEN
    RAISE EXCEPTION 'MESSAGE_FORBIDDEN: esta conversación no es tuya.';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_message_insert ON public.messages;
CREATE TRIGGER trg_message_insert
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_message_insert();

-- ── Del UPDATE solo pasa `read_at` ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_message_update()
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
  IF NEW.body IS DISTINCT FROM OLD.body
     OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
     OR NEW.patient_id IS DISTINCT FROM OLD.patient_id
     OR NEW.therapist_id IS DISTINCT FROM OLD.therapist_id
     OR NEW.relationship_id IS DISTINCT FROM OLD.relationship_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'MESSAGE_IMMUTABLE: un mensaje enviado no se edita. Solo puede marcarse como leído.';
  END IF;

  -- Marcar leído solo dentro de la propia conversación.
  IF NOT es_sistema AND quien IS DISTINCT FROM OLD.patient_id AND quien IS DISTINCT FROM OLD.therapist_id THEN
    RAISE EXCEPTION 'MESSAGE_FORBIDDEN: esta conversación no es tuya.';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_message_update ON public.messages;
CREATE TRIGGER trg_message_update
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_message_update();

-- ── Nada se borra ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_message_no_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'MESSAGE_APPEND_ONLY: un mensaje no se borra.';
END
$$;

DROP TRIGGER IF EXISTS trg_message_no_delete ON public.messages;
CREATE TRIGGER trg_message_no_delete
  BEFORE DELETE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_message_no_delete();

-- ── Lectura: solo las dos partes ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.list_relationship_messages(p_relationship_id uuid)
RETURNS TABLE (
  id uuid, relationship_id uuid, sender_id uuid, body text,
  read_at timestamptz, created_at timestamptz
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT m.id, m.relationship_id, m.sender_id, m.body, m.read_at, m.created_at
  FROM messages m
  JOIN patient_therapist r ON r.id = m.relationship_id
  WHERE m.relationship_id = p_relationship_id
    AND auth.uid() IS NOT NULL
    AND (r.patient_id = auth.uid() OR r.therapist_id = auth.uid())
  ORDER BY m.created_at ASC
$$;

COMMENT ON FUNCTION public.list_relationship_messages(uuid) IS
  'Mensajes de una conversación, en orden cronológico. Solo para las dos partes: filtra por auth.uid().';

REVOKE ALL ON FUNCTION public.list_relationship_messages(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_relationship_messages(uuid) TO authenticated;

-- NOTA DE SEGURIDAD PENDIENTE
-- `messages` conserva GRANT SELECT a anon y authenticated de antes de este
-- cambio: el contenido de las conversaciones es legible por cualquiera. NO se
-- revoca aquí porque ChatThread, PatientMessages, TherapistMessages y los dos
-- paneles consultan la tabla directamente y quedarían rotos. Migrarlos a esta
-- función y ejecutar el REVOKE es lo que cierra el agujero.

-- ── Policies equivalentes, para cuando se active RLS ────────────────────────
-- ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
--
-- CREATE POLICY "las dos partes leen su conversación"
--   ON public.messages FOR SELECT USING (
--     EXISTS (SELECT 1 FROM patient_therapist r WHERE r.id = messages.relationship_id
--             AND (r.patient_id = auth.uid() OR r.therapist_id = auth.uid())));
-- CREATE POLICY "solo se escribe en nombre propio"
--   ON public.messages FOR INSERT WITH CHECK (sender_id = auth.uid());
-- CREATE POLICY "las dos partes marcan leído"
--   ON public.messages FOR UPDATE USING (
--     EXISTS (SELECT 1 FROM patient_therapist r WHERE r.id = messages.relationship_id
--             AND (r.patient_id = auth.uid() OR r.therapist_id = auth.uid())));
-- -- Sin policy de DELETE: nadie borra. Además del trigger.
