-- ============================================================================
-- Broadcast para la mensajería, para poder cerrar el último SELECT abierto.
--
-- ── Por qué ─────────────────────────────────────────────────────────────────
--
-- Las cuatro suscripciones de la mensajería usaban `postgres_changes` sobre
-- `messages`, y ese mecanismo exige SELECT sobre la tabla. Mientras existiera,
-- cualquier usuario autenticado podía leer las conversaciones de todo el mundo.
-- Broadcast no lee la tabla: el servidor EMITE un aviso, y el cliente vuelve a
-- pedir sus datos por las funciones seguras que ya existen.
--
-- ── Qué viaja, y qué no ─────────────────────────────────────────────────────
--
-- El aviso lleva identificadores y marcas de tiempo. NUNCA el cuerpo del
-- mensaje, ni el paciente, ni el profesional, ni nada clínico. Un Broadcast es
-- una campana, no un sobre: dice "mira otra vez", no "esto es lo que pasó".
-- Quien lo recibe tiene que volver a preguntar, y ahí la base decide qué puede
-- ver. Si el aviso llevara el contenido, habríamos movido el agujero en vez de
-- cerrarlo.
--
-- ── Encaminamiento ──────────────────────────────────────────────────────────
--
-- Un canal PRIVADO por persona: `user:{profile_id}`. Cada evento se emite a las
-- dos partes, y cada pantalla decide si le afecta —los clientes ya distinguen
-- lo propio de lo ajeno por `sender_id`—. La política de `realtime.messages`
-- deja escuchar únicamente el canal propio: `user:` + auth.uid().
--
-- El identificador de la persona va en el NOMBRE DEL CANAL, no en el payload.
-- Es encaminamiento, no contenido: para escuchar ese canal ya hay que ser esa
-- persona.
--
-- ── Si Broadcast falla ──────────────────────────────────────────────────────
--
-- El trigger es AFTER —la escritura ya está aceptada— y va envuelto en un
-- bloque que se traga cualquier error. Un aviso perdido significa que alguien
-- ve el mensaje un segundo más tarde; una excepción aquí significaría que el
-- mensaje no se envía. No hay comparación.
-- ============================================================================

-- ── Quién puede escuchar qué ────────────────────────────────────────────────
-- `realtime.messages` ya tiene RLS activado y ninguna política, así que hoy los
-- canales privados no dejan escuchar a nadie. Esta es la única que se crea.
DROP POLICY IF EXISTS "solo el canal propio" ON realtime.messages;
CREATE POLICY "solo el canal propio"
  ON realtime.messages FOR SELECT
  TO authenticated
  USING (realtime.topic() = 'user:' || auth.uid()::text);

-- ── El emisor ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.broadcast_message_event(
  p_evento text, p_relationship_id uuid, p_message_id uuid,
  p_sender_id uuid, p_created_at timestamptz, p_read_at timestamptz,
  p_destinatarios uuid[]
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  quien uuid;
  cuerpo jsonb := jsonb_build_object(
    'type',            p_evento,
    'relationship_id', p_relationship_id,
    'message_id',      p_message_id,
    'sender_id',       p_sender_id,
    'created_at',      p_created_at,
    'read_at',         p_read_at
  );
BEGIN
  FOREACH quien IN ARRAY p_destinatarios LOOP
    CONTINUE WHEN quien IS NULL;
    BEGIN
      PERFORM realtime.send(cuerpo, p_evento, 'user:' || quien::text, true);
    EXCEPTION WHEN OTHERS THEN
      -- Un aviso perdido no puede tumbar el mensaje que ya se guardó.
      NULL;
    END;
  END LOOP;
END
$$;

-- ── Alta de mensaje ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_message_broadcast_insert()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM broadcast_message_event(
    'message_sent', NEW.relationship_id, NEW.id, NEW.sender_id,
    NEW.created_at, NEW.read_at, ARRAY[NEW.patient_id, NEW.therapist_id]);
  RETURN NULL;
END
$$;

DROP TRIGGER IF EXISTS trg_message_broadcast_insert ON public.messages;
CREATE TRIGGER trg_message_broadcast_insert
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_message_broadcast_insert();

-- ── Marcado de leído ────────────────────────────────────────────────────────
-- Solo eso. Ningún otro UPDATE emite: el trigger de reglas ya impide que
-- cambie otra cosa, pero la condición se deja explícita para que quede claro
-- qué se está anunciando.
CREATE OR REPLACE FUNCTION public.notify_message_broadcast_read()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.read_at IS DISTINCT FROM OLD.read_at AND NEW.read_at IS NOT NULL THEN
    PERFORM broadcast_message_event(
      'message_read', NEW.relationship_id, NEW.id, NEW.sender_id,
      NEW.created_at, NEW.read_at, ARRAY[NEW.patient_id, NEW.therapist_id]);
  END IF;
  RETURN NULL;
END
$$;

DROP TRIGGER IF EXISTS trg_message_broadcast_read ON public.messages;
CREATE TRIGGER trg_message_broadcast_read
  AFTER UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_message_broadcast_read();

-- ── Fuera de la publicación de postgres_changes ─────────────────────────────
-- Aunque quedara un cliente suscrito por el mecanismo antiguo, ya no recibiría
-- nada. `clinical_alerts` sigue publicada: sus dos suscripciones no son de este
-- sprint.
ALTER PUBLICATION supabase_realtime DROP TABLE public.messages;

REVOKE ALL ON FUNCTION public.broadcast_message_event(text, uuid, uuid, uuid, timestamptz, timestamptz, uuid[]) FROM PUBLIC;
