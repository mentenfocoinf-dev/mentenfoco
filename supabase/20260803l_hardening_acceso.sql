-- ============================================================================
-- Endurecimiento: una sola forma de leer datos sensibles.
--
-- ── Lo que había ────────────────────────────────────────────────────────────
--
-- `messages`, `patient_therapist` y `therapy_sessions` conceden hoy SELECT,
-- INSERT, UPDATE y DELETE a `anon` y `authenticated`. Con RLS desactivado eso
-- significa que cualquiera —incluido un visitante sin sesión— puede leer las
-- conversaciones de todo el mundo, quién atiende a quién y la agenda clínica
-- completa. Es el agujero que vengo señalando desde hace varios sprints.
--
-- ── La regla ────────────────────────────────────────────────────────────────
--
-- Toda LECTURA pasa por funciones SECURITY DEFINER que filtran por auth.uid()
-- dentro. El cliente no vuelve a consultar estas tablas directamente.
--
-- La ESCRITURA se mantiene directa donde ya está protegida por triggers de
-- propiedad —así funcionan mensajes, relaciones y citas— porque mover un
-- INSERT a una función no añade seguridad si el trigger ya decide. Lo que sí
-- faltaba era ese trigger en `therapy_sessions`: era la única de las tres sin
-- dueño, y cualquiera podía agendar una sesión a nombre de otro profesional.
--
-- ── Lo que NO se puede cerrar todavía, y por qué ────────────────────────────
--
-- `messages` conserva SELECT para `authenticated`. Cuatro suscripciones de
-- Realtime (`postgres_changes` sobre la tabla) dependen de ese permiso: sin él
-- el chat y los contadores dejan de actualizarse solos, que es un cambio
-- funcional. Cerrarlo exige migrar esas suscripciones a Broadcast, y eso es
-- una decisión de arquitectura fuera del alcance de este sprint. Para `anon`
-- sí se cierra: ninguna suscripción anónima es legítima.
-- ============================================================================

-- ── therapy_sessions: le faltaba dueño ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_therapy_session_ownership()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  quien uuid := auth.uid();
  rol   text := coalesce(current_setting('request.jwt.claims', true)::json->>'role', '');
  es_sistema boolean := (rol = 'service_role') OR (quien IS NULL AND rol = '');
  es_admin boolean;
BEGIN
  IF es_sistema THEN RETURN NEW; END IF;

  SELECT p.role = 'admin' INTO es_admin FROM profiles p WHERE p.id = quien;
  IF coalesce(es_admin, false) THEN RETURN NEW; END IF;

  -- Solo las dos partes de la sesión la tocan. Agendar a nombre de otro
  -- profesional era posible hasta ahora.
  IF quien IS DISTINCT FROM NEW.therapist_id AND quien IS DISTINCT FROM NEW.patient_id THEN
    RAISE EXCEPTION 'SESSION_FORBIDDEN: esta sesión no es tuya.';
  END IF;

  IF TG_OP = 'UPDATE'
     AND (NEW.patient_id IS DISTINCT FROM OLD.patient_id
          OR NEW.therapist_id IS DISTINCT FROM OLD.therapist_id) THEN
    RAISE EXCEPTION 'SESSION_IMMUTABLE: no se cambia de paciente ni de profesional.';
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_therapy_session_ownership ON public.therapy_sessions;
CREATE TRIGGER trg_therapy_session_ownership
  BEFORE INSERT OR UPDATE ON public.therapy_sessions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_therapy_session_ownership();

-- ── Lecturas que faltaban ───────────────────────────────────────────────────

/** El profesional asignado a quien llama. NULL si no tiene. */
CREATE OR REPLACE FUNCTION public.get_assigned_therapist()
RETURNS uuid
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT r.therapist_id FROM patient_therapist r
  WHERE auth.uid() IS NOT NULL AND r.patient_id = auth.uid() AND r.status = 'active'
  LIMIT 1
$$;

/** Pacientes de quien llama, con los datos que ya mostraba el panel. */
CREATE OR REPLACE FUNCTION public.list_my_patients_detail()
RETURNS TABLE (
  patient_id uuid, therapist_id uuid, created_at timestamptz,
  full_name text, email text, plan_type public.plan_type, subscription_status text
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT r.patient_id, r.therapist_id, r.created_at,
         p.full_name, p.email, p.plan_type, p.subscription_status
  FROM patient_therapist r
  JOIN profiles p ON p.id = r.patient_id
  WHERE auth.uid() IS NOT NULL
    AND (r.therapist_id = auth.uid()
         OR EXISTS (SELECT 1 FROM profiles a WHERE a.id = auth.uid() AND a.role = 'admin'))
$$;

/** Sesiones de quien llama, como paciente o como profesional. */
CREATE OR REPLACE FUNCTION public.list_my_sessions()
RETURNS TABLE (
  id uuid, patient_id uuid, therapist_id uuid, scheduled_at timestamptz,
  duration_minutes integer, status text, video_call_link text,
  reminder_status text, notes text, created_at timestamptz, updated_at timestamptz,
  counterpart_name text, counterpart_email text
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT s.id, s.patient_id, s.therapist_id, s.scheduled_at,
         s.duration_minutes, s.status, s.video_call_link,
         s.reminder_status, s.notes, s.created_at, s.updated_at,
         p.full_name, p.email
  FROM therapy_sessions s
  JOIN profiles p ON p.id = CASE WHEN s.patient_id = auth.uid() THEN s.therapist_id
                                 ELSE s.patient_id END
  WHERE auth.uid() IS NOT NULL
    AND (s.patient_id = auth.uid() OR s.therapist_id = auth.uid())
  ORDER BY s.scheduled_at ASC
$$;

/** Sesiones completadas de quien llama en el mes indicado. Para la cuota. */
CREATE OR REPLACE FUNCTION public.count_my_completed_sessions(p_desde timestamptz, p_hasta timestamptz)
RETURNS integer
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT coalesce(count(*), 0)::integer FROM therapy_sessions
  WHERE auth.uid() IS NOT NULL AND patient_id = auth.uid()
    AND status = 'completada' AND scheduled_at >= p_desde AND scheduled_at < p_hasta
$$;

REVOKE ALL ON FUNCTION public.get_assigned_therapist() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_my_patients_detail() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_my_sessions() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.count_my_completed_sessions(timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_assigned_therapist() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_patients_detail() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_sessions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_my_completed_sessions(timestamptz, timestamptz) TO authenticated;

-- Los REVOKE van en 20260803m, DESPUÉS de migrar a los consumidores: quitar un
-- permiso del que todavía depende una pantalla es romperla.
-- Lecturas de `messages` por función. Se crean aunque el SELECT directo siga
-- concedido para Realtime: así, cuando esas suscripciones migren, cerrar el
-- permiso es una sola línea y no una reescritura.

CREATE OR REPLACE FUNCTION public.list_pair_messages(p_patient_id uuid, p_therapist_id uuid)
RETURNS TABLE (id uuid, patient_id uuid, therapist_id uuid, sender_id uuid,
               body text, read_at timestamptz, created_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT m.id, m.patient_id, m.therapist_id, m.sender_id, m.body, m.read_at, m.created_at
  FROM messages m
  WHERE auth.uid() IS NOT NULL
    AND m.patient_id = p_patient_id AND m.therapist_id = p_therapist_id
    AND (m.patient_id = auth.uid() OR m.therapist_id = auth.uid())
  ORDER BY m.created_at ASC
$$;

CREATE OR REPLACE FUNCTION public.count_my_unread_messages()
RETURNS integer
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT coalesce(count(*), 0)::integer FROM messages
  WHERE auth.uid() IS NOT NULL
    AND (patient_id = auth.uid() OR therapist_id = auth.uid())
    AND sender_id <> auth.uid() AND read_at IS NULL
$$;

CREATE OR REPLACE FUNCTION public.list_my_conversations()
RETURNS TABLE (patient_id uuid, patient_name text, last_message text,
               last_message_at timestamptz, unread_count integer)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT m.patient_id,
         coalesce(p.full_name, p.email, 'Paciente'),
         (array_agg(m.body ORDER BY m.created_at DESC))[1],
         max(m.created_at),
         count(*) FILTER (WHERE m.sender_id <> auth.uid() AND m.read_at IS NULL)::integer
  FROM messages m
  JOIN profiles p ON p.id = m.patient_id
  WHERE auth.uid() IS NOT NULL AND m.therapist_id = auth.uid()
  GROUP BY m.patient_id, p.full_name, p.email
  ORDER BY max(m.created_at) DESC
$$;

REVOKE ALL ON FUNCTION public.list_pair_messages(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.count_my_unread_messages() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_my_conversations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_pair_messages(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_my_unread_messages() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_conversations() TO authenticated;
