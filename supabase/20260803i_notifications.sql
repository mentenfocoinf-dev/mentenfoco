-- ============================================================================
-- notifications — otro consumidor de los hechos que ya ocurren.
--
-- No hay motor nuevo ni sistema de eventos nuevo. Los hechos ya se registran
-- donde tienen que registrarse —una solicitud en `therapist_contact_requests`,
-- una asignación en `patient_therapist`, un mensaje en `messages`, un paso
-- ofrecido en `journey_events`— y esta tabla se limita a escuchar.
--
-- Por eso la generación vive en TRIGGERS sobre esas tablas y no en React: una
-- notificación que dependa de que el cliente la cree se pierde en cuanto
-- alguien cierra la pestaña, y el hecho ya habría ocurrido igual. Aquí, si el
-- hecho se guardó, la notificación existe.
--
-- ── Qué NO se guarda ────────────────────────────────────────────────────────
--
-- Nada que ya viva en el hecho original: ni el texto del mensaje, ni el motivo
-- de la solicitud, ni el estado actual de nada. Solo lo justo para dibujar una
-- línea y saber a dónde lleva — título, texto corto y a qué recurso apunta. El
-- detalle se lee en su sitio, que es donde está al día.
--
-- ── Seguridad, con RLS desactivado ──────────────────────────────────────────
--
-- Saber que a alguien le aceptaron una solicitud con un psicólogo es
-- información de salud. La tabla NO concede SELECT a nadie: se lee por
-- funciones SECURITY DEFINER que filtran por auth.uid(). Tampoco concede
-- INSERT: las notificaciones nacen de triggers, nunca del cliente, así que
-- nadie puede fabricarle una notificación a otra persona.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- El mismo nombre que el evento que la originó. No se inventa un catálogo
  -- paralelo: si el evento se llama MESSAGE_SENT, esto dice MESSAGE_SENT.
  event_type      text NOT NULL CHECK (event_type ~ '^[A-Z][A-Z0-9_]{2,63}$'),

  title           text NOT NULL CHECK (length(trim(title)) > 0),
  body            text CHECK (body IS NULL OR length(body) <= 300),

  -- A dónde lleva. `resource_id` es texto porque unas veces es un slug y otras
  -- un uuid, y forzar un tipo obligaría a dos columnas.
  resource_type   text,
  resource_id     text,
  relationship_id uuid REFERENCES public.patient_therapist(id) ON DELETE SET NULL,

  read_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.notifications IS
  'Avisos derivados de hechos que ya ocurrieron. No duplica el contenido del hecho: solo lo necesario para mostrarlo y navegar hasta él.';

-- Sin repetir lo mismo sin leer: volver a entrar en un programa no debe dejar
-- diez avisos del mismo paso. Una vez leída, un aviso nuevo sí puede aparecer.
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_sin_repetir
  ON public.notifications (user_id, event_type, resource_id)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_bandeja
  ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_no_leidas
  ON public.notifications (user_id) WHERE read_at IS NULL;

-- ── Del UPDATE solo pasa `read_at`, y solo al dueño ─────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_notification_rules()
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
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.event_type IS DISTINCT FROM OLD.event_type
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.body IS DISTINCT FROM OLD.body
     OR NEW.resource_type IS DISTINCT FROM OLD.resource_type
     OR NEW.resource_id IS DISTINCT FROM OLD.resource_id
     OR NEW.relationship_id IS DISTINCT FROM OLD.relationship_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'NOTIFICATION_IMMUTABLE: una notificación solo puede marcarse como leída.';
  END IF;

  IF NOT es_sistema AND OLD.user_id IS DISTINCT FROM quien THEN
    RAISE EXCEPTION 'NOTIFICATION_FORBIDDEN: esta notificación no es tuya.';
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_notification_rules ON public.notifications;
CREATE TRIGGER trg_notification_rules
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.enforce_notification_rules();

-- ── Generación ──────────────────────────────────────────────────────────────
--
-- Un solo punto de alta. `ON CONFLICT DO NOTHING` para que el índice de
-- no-repetición no haga fallar la operación original: una notificación que no
-- se crea porque ya existe sin leer no puede tumbar el envío de un mensaje.
CREATE OR REPLACE FUNCTION public.push_notification(
  p_user_id uuid, p_event_type text, p_title text, p_body text,
  p_resource_type text, p_resource_id text, p_relationship_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;
  INSERT INTO notifications (user_id, event_type, title, body,
                             resource_type, resource_id, relationship_id)
  VALUES (p_user_id, p_event_type, p_title, p_body,
          p_resource_type, p_resource_id, p_relationship_id)
  ON CONFLICT DO NOTHING;
END
$$;

-- Solicitudes de contacto: nace → avisa al profesional.
CREATE OR REPLACE FUNCTION public.notify_contact_request_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM push_notification(
    NEW.therapist_profile_id, 'CONTACT_REQUEST_CREATED',
    'Nueva solicitud de contacto',
    'Una persona quiere empezar un proceso contigo.',
    'solicitud', NEW.id::text, NULL);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_contact_request_created ON public.therapist_contact_requests;
CREATE TRIGGER trg_notify_contact_request_created
  AFTER INSERT ON public.therapist_contact_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_contact_request_created();

-- Resuelta → avisa a quien la envió. Cancelada no: la canceló él mismo.
CREATE OR REPLACE FUNCTION public.notify_contact_request_resolved()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rel uuid;
BEGIN
  IF OLD.status = 'pending' AND NEW.status = 'accepted' THEN
    SELECT id INTO rel FROM patient_therapist WHERE contact_request_id = NEW.id;
    PERFORM push_notification(
      NEW.patient_id, 'CONTACT_REQUEST_ACCEPTED',
      'Tu solicitud fue aceptada',
      'Ya puedes escribirle a tu profesional.',
      'solicitud', NEW.id::text, rel);
  ELSIF OLD.status = 'pending' AND NEW.status = 'rejected' THEN
    PERFORM push_notification(
      NEW.patient_id, 'CONTACT_REQUEST_REJECTED',
      'Tu solicitud no fue aceptada',
      'Puedes buscar otro profesional cuando quieras.',
      'solicitud', NEW.id::text, NULL);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_contact_request_resolved ON public.therapist_contact_requests;
CREATE TRIGGER trg_notify_contact_request_resolved
  AFTER UPDATE ON public.therapist_contact_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_contact_request_resolved();

-- Relación creada → las dos partes.
CREATE OR REPLACE FUNCTION public.notify_therapist_assigned()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM push_notification(NEW.patient_id, 'THERAPIST_ASSIGNED',
    'Ya tienes profesional asignado', 'Puedes abrir la conversación cuando quieras.',
    'relacion', NEW.id::text, NEW.id);
  PERFORM push_notification(NEW.therapist_id, 'THERAPIST_ASSIGNED',
    'Tienes un paciente nuevo', 'La conversación ya está disponible.',
    'relacion', NEW.id::text, NEW.id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_therapist_assigned ON public.patient_therapist;
CREATE TRIGGER trg_notify_therapist_assigned
  AFTER INSERT ON public.patient_therapist
  FOR EACH ROW EXECUTE FUNCTION public.notify_therapist_assigned();

-- Mensaje → avisa a la otra parte, nunca a quien escribe.
CREATE OR REPLACE FUNCTION public.notify_message_sent()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE destinatario uuid;
BEGIN
  destinatario := CASE WHEN NEW.sender_id = NEW.patient_id THEN NEW.therapist_id
                       ELSE NEW.patient_id END;
  -- El texto del mensaje NO viaja aquí: se lee en la conversación.
  PERFORM push_notification(destinatario, 'MESSAGE_SENT',
    'Tienes un mensaje nuevo', NULL,
    'conversacion', NEW.relationship_id::text, NEW.relationship_id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_message_sent ON public.messages;
CREATE TRIGGER trg_notify_message_sent
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_message_sent();

-- Siguiente paso: se escucha `journey_events`, no el motor. Solo con sesión —
-- un visitante anónimo no tiene bandeja donde recibir nada.
CREATE OR REPLACE FUNCTION public.notify_from_journey_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;

  IF NEW.event_name = 'NEXT_STEP_SHOWN' THEN
    PERFORM push_notification(NEW.user_id, 'NEXT_STEP_SHOWN',
      'Tienes un paso pendiente', 'Continúa por donde lo dejaste.',
      coalesce(NEW.metadata->>'resource_type', 'contenido'),
      NEW.metadata->>'resource_id', NULL);
  ELSIF NEW.event_name = 'NEXT_STEP_OPENED' THEN
    PERFORM push_notification(NEW.user_id, 'NEXT_STEP_OPENED',
      'Retomaste tu programa', NULL,
      coalesce(NEW.metadata->>'resource_type', 'contenido'),
      NEW.metadata->>'resource_id', NULL);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_from_journey_event ON public.journey_events;
CREATE TRIGGER trg_notify_from_journey_event
  AFTER INSERT ON public.journey_events
  FOR EACH ROW EXECUTE FUNCTION public.notify_from_journey_event();

-- ── Lectura ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.list_my_notifications(p_limit integer DEFAULT 30)
RETURNS TABLE (
  id uuid, event_type text, title text, body text,
  resource_type text, resource_id text, relationship_id uuid,
  read_at timestamptz, created_at timestamptz
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT n.id, n.event_type, n.title, n.body,
         n.resource_type, n.resource_id, n.relationship_id, n.read_at, n.created_at
  FROM notifications n
  WHERE auth.uid() IS NOT NULL AND n.user_id = auth.uid()
  ORDER BY n.created_at DESC
  LIMIT greatest(1, least(coalesce(p_limit, 30), 100))
$$;

CREATE OR REPLACE FUNCTION public.count_my_unread_notifications()
RETURNS integer
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT coalesce(count(*), 0)::integer FROM notifications
  WHERE auth.uid() IS NOT NULL AND user_id = auth.uid() AND read_at IS NULL
$$;

-- ── Permisos ────────────────────────────────────────────────────────────────
-- Ni SELECT ni INSERT ni DELETE: se lee por función y se crea por trigger.
-- UPDATE solo para poder marcar leído, y el trigger limita qué puede cambiar.
REVOKE ALL ON public.notifications FROM anon, authenticated;
GRANT UPDATE ON public.notifications TO authenticated;

REVOKE ALL ON FUNCTION public.list_my_notifications(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.count_my_unread_notifications() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.push_notification(uuid, text, text, text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_my_notifications(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_my_unread_notifications() TO authenticated;

-- ── Policies equivalentes, para cuando se active RLS ────────────────────────
-- ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
--
-- CREATE POLICY "cada quien lee las suyas"
--   ON public.notifications FOR SELECT USING (user_id = auth.uid());
-- CREATE POLICY "cada quien marca las suyas"
--   ON public.notifications FOR UPDATE USING (user_id = auth.uid());
-- -- Sin policy de INSERT ni de DELETE: nacen de triggers y no se borran.
