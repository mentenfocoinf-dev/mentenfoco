-- ============================================================================
-- Cierre del módulo Agenda: cuatro cosas que pertenecen a PostgreSQL.
--
--   1. Quién puede escribir en una sesión clínica   ← DEFECTO GRAVE
--   2. Bloqueos y vacaciones del profesional
--   3. Reprogramar una cita YA confirmada
--   4. Que los bloqueos los aplique también el INSERT, no solo el selector
--
-- ============================================================================
-- 1. EL DEFECTO: el paciente podía escribir la sesión clínica entera
-- ============================================================================
--
-- `enforce_therapy_session_ownership` comprobaba que quien escribe sea UNA DE
-- LAS DOS PARTES, sin distinguir cuál. Y `authenticated` tiene UPDATE sobre
-- TODAS las columnas de `therapy_sessions`. Resultado, demostrado con
-- `SET LOCAL ROLE authenticated` y rollback forzado:
--
--     1 paciente cambia el enlace Meet: PUEDE
--     2 paciente sobrescribe observaciones clinicas: PUEDE
--     3 paciente marca la sesion como realizada: PUEDE
--     4 paciente mueve la sesion a otra fecha: PUEDE
--
-- La cuarta es la peor: mover `scheduled_at` salta por encima de toda la
-- negociación de citas —solicitud, confirmación, contraoferta— que se construyó
-- precisamente para que una hora no se cambie unilateralmente. La segunda es la
-- más delicada: `notes` es donde el profesional deja la evolución clínica.
--
-- ── La corrección ───────────────────────────────────────────────────────────
--
-- El paciente NO escribe sesiones. Su agenda se gobierna por `appointments`,
-- que ya tiene sus reglas. Aquí solo lee.
--
-- Con una excepción imprescindible: cuando el paciente cancela una cita o
-- acepta una contraoferta, `materialize_session_on_confirm` escribe la sesión
-- EN SU NOMBRE. Esa escritura es legítima y ya la validaron las reglas de
-- `appointments`. Se distingue por `pg_trigger_depth() > 1`: viene anidada
-- dentro de otro trigger, no de una llamada directa del cliente.
--
-- Se añaden además dos reglas que faltaban para el profesional:
--
--   · una sesión nacida de una cita NO cambia de hora por su lado: la hora vive
--     en la cita y la cita es inmutable. Tenerlas discrepando sería peor que no
--     poder moverla.
--   · una sesión cerrada no vuelve a abrirse, igual que `APPOINTMENT_CLOSED`.
--     Las observaciones SÍ se siguen pudiendo escribir: la evolución clínica se
--     redacta después de la sesión, no antes.
-- ============================================================================

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

  -- Solo las dos partes de la sesión la tocan.
  IF quien IS DISTINCT FROM NEW.therapist_id AND quien IS DISTINCT FROM NEW.patient_id THEN
    RAISE EXCEPTION 'SESSION_FORBIDDEN: esta sesión no es tuya.';
  END IF;

  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  IF NEW.patient_id IS DISTINCT FROM OLD.patient_id
     OR NEW.therapist_id IS DISTINCT FROM OLD.therapist_id THEN
    RAISE EXCEPTION 'SESSION_IMMUTABLE: no se cambia de paciente ni de profesional.';
  END IF;

  -- Escritura en cascada desde los triggers de `appointments`: ya validada allí.
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- El paciente no gobierna la sesión clínica. Su agenda se negocia en citas.
  IF quien = OLD.patient_id AND quien IS DISTINCT FROM OLD.therapist_id THEN
    RAISE EXCEPTION 'SESSION_PATIENT_READ_ONLY: tu profesional gestiona los datos de la sesión.';
  END IF;

  -- La hora de una sesión que nació de una cita vive en la cita, y la cita es
  -- inmutable. Para cambiarla se reprograma, que deja rastro.
  IF OLD.appointment_id IS NOT NULL
     AND (NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at
          OR NEW.duration_minutes IS DISTINCT FROM OLD.duration_minutes) THEN
    RAISE EXCEPTION 'SESSION_TIME_LOCKED: para cambiar la hora hay que reprogramar la cita.';
  END IF;

  -- Lo cerrado no se reabre. Las observaciones sí siguen abiertas: la evolución
  -- clínica se escribe DESPUÉS de la sesión.
  IF OLD.status IN ('completada', 'cancelada', 'no_asistio') THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'SESSION_CLOSED: esta sesión ya está cerrada.';
    END IF;
    IF NEW.video_call_link IS DISTINCT FROM OLD.video_call_link THEN
      RAISE EXCEPTION 'SESSION_CLOSED: el enlace de una sesión cerrada no se cambia.';
    END IF;
  END IF;

  RETURN NEW;
END
$$;

-- ============================================================================
-- 2. Bloqueos y vacaciones
-- ============================================================================
--
-- Una sola tabla para las dos cosas porque son la misma: un rango de tiempo en
-- el que el profesional no atiende. Lo que cambia es el motivo, y el motivo es
-- una etiqueta, no una estructura distinta.
--
-- Un día completo es un rango de 00:00 a 24:00. No hace falta una columna
-- "día entero": el rango ya lo expresa, y una columna que puede contradecir al
-- rango es una fuente de incoherencias.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agenda_block_kind') THEN
    CREATE TYPE public.agenda_block_kind AS ENUM ('vacaciones', 'bloqueo');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.therapist_time_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  kind public.agenda_block_kind NOT NULL DEFAULT 'bloqueo',
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blocks_intervalo_valido CHECK (ends_at > starts_at),
  CONSTRAINT blocks_duracion_razonable CHECK (ends_at - starts_at <= interval '120 days'),
  CONSTRAINT blocks_reason_check CHECK (reason IS NULL OR length(reason) <= 300)
);

CREATE INDEX IF NOT EXISTS therapist_time_blocks_agenda_idx
  ON public.therapist_time_blocks (therapist_id, starts_at, ends_at);

COMMENT ON TABLE public.therapist_time_blocks IS
  'Rangos en los que el profesional no atiende. Vacaciones y bloqueos puntuales son lo mismo con distinta etiqueta.';

-- Un bloqueo es del profesional y de nadie más.
CREATE OR REPLACE FUNCTION public.enforce_time_block_ownership()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  quien uuid := auth.uid();
  rol   text := coalesce(current_setting('request.jwt.claims', true)::json->>'role', '');
BEGIN
  IF (rol = 'service_role') OR (quien IS NULL AND rol = '') THEN RETURN NEW; END IF;

  IF TG_OP = 'DELETE' THEN
    IF quien IS DISTINCT FROM OLD.therapist_id THEN
      RAISE EXCEPTION 'BLOCK_FORBIDDEN: ese bloqueo no es tuyo.';
    END IF;
    RETURN OLD;
  END IF;

  -- Derivado, no aceptado de fuera.
  NEW.therapist_id := quien;

  IF TG_OP = 'UPDATE' AND OLD.therapist_id IS DISTINCT FROM quien THEN
    RAISE EXCEPTION 'BLOCK_FORBIDDEN: ese bloqueo no es tuyo.';
  END IF;

  -- Bloquear el pasado no sirve para nada y esconde errores de fecha.
  IF NEW.ends_at <= now() THEN
    RAISE EXCEPTION 'BLOCK_IN_THE_PAST: no se bloquea un rango que ya pasó.';
  END IF;

  -- Un bloqueo no puede caer encima de algo ya agendado: primero se resuelve lo
  -- que hay. Si no, quedarían sesiones dentro de unas vacaciones.
  IF EXISTS (
    SELECT 1 FROM therapy_sessions s
    WHERE s.therapist_id = NEW.therapist_id
      AND s.status NOT IN ('cancelada', 'completada', 'no_asistio')
      AND tstzrange(s.scheduled_at, s.scheduled_at + make_interval(mins => s.duration_minutes))
          && tstzrange(NEW.starts_at, NEW.ends_at)
  ) OR EXISTS (
    SELECT 1 FROM appointments a
    WHERE a.therapist_id = NEW.therapist_id
      AND a.status IN ('requested', 'confirmed')
      AND tstzrange(a.starts_at, a.ends_at) && tstzrange(NEW.starts_at, NEW.ends_at)
  ) THEN
    RAISE EXCEPTION 'BLOCK_OVERLAPS_AGENDA: hay citas o sesiones dentro de ese rango.';
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_time_block_ownership ON public.therapist_time_blocks;
CREATE TRIGGER trg_time_block_ownership
  BEFORE INSERT OR UPDATE OR DELETE ON public.therapist_time_blocks
  FOR EACH ROW EXECUTE FUNCTION public.enforce_time_block_ownership();

-- Mismo criterio que el resto del proyecto: la lectura pasa por función.
REVOKE ALL ON public.therapist_time_blocks FROM authenticated, anon;
GRANT INSERT, DELETE ON public.therapist_time_blocks TO authenticated;
-- DELETE necesita leer la columna del WHERE. Nada más se concede.
GRANT SELECT (id, therapist_id) ON public.therapist_time_blocks TO authenticated;

CREATE OR REPLACE FUNCTION public.list_my_time_blocks(
  p_desde timestamptz DEFAULT now(),
  p_hasta timestamptz DEFAULT now() + interval '180 days'
)
RETURNS TABLE (
  id uuid, starts_at timestamptz, ends_at timestamptz,
  kind agenda_block_kind, reason text
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT b.id, b.starts_at, b.ends_at, b.kind, b.reason
  FROM therapist_time_blocks b
  WHERE auth.uid() IS NOT NULL
    AND b.therapist_id = auth.uid()
    AND tstzrange(b.starts_at, b.ends_at) && tstzrange(p_desde, p_hasta)
  ORDER BY b.starts_at
$$;

REVOKE ALL ON FUNCTION public.list_my_time_blocks(timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_my_time_blocks(timestamptz, timestamptz) TO authenticated;

-- ============================================================================
-- 3. El punto de extensión deja de ser un stub
-- ============================================================================
--
-- `agenda_bloqueo_manual` se creó devolviendo `false` para que el día que
-- existiera la tabla no hubiera que tocar nada más. Hoy es ese día: se sustituye
-- el cuerpo y `hora_ocupada` —y con ella `available_hours`— se entera sola.
-- ============================================================================

DROP FUNCTION IF EXISTS public.agenda_bloqueo_manual(uuid, timestamptz, timestamptz);

CREATE FUNCTION public.agenda_bloqueo_manual(
  p_therapist_id uuid,
  p_inicio timestamptz,
  p_fin timestamptz
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM therapist_time_blocks b
    WHERE b.therapist_id = p_therapist_id
      AND tstzrange(b.starts_at, b.ends_at) && tstzrange(p_inicio, p_fin)
  )
$$;

COMMENT ON FUNCTION public.agenda_bloqueo_manual(uuid, timestamptz, timestamptz) IS
  'Si el profesional tiene un bloqueo o vacaciones solapando ese rango.';

REVOKE ALL ON FUNCTION public.agenda_bloqueo_manual(uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.agenda_bloqueo_manual(uuid, timestamptz, timestamptz) TO authenticated;

-- ============================================================================
-- 4. Que el bloqueo lo aplique también el INSERT
-- ============================================================================
--
-- Un bloqueo que solo conociera `available_hours` sería una regla de selector:
-- se saltaría con una petición directa. Los dos triggers de agenda pasan a
-- preguntar por `hora_ocupada`, que ya compone conflictos + bloqueos.
--
-- No se relaja nada: `hora_ocupada` incluye `agenda_hay_conflicto` íntegro y le
-- SUMA los bloqueos. Todo lo que se rechazaba antes se sigue rechazando.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.hora_ocupada(
  p_therapist_id uuid,
  p_patient_id uuid,
  p_inicio timestamptz,
  p_fin timestamptz,
  p_ignorar_cita uuid DEFAULT NULL,
  p_ignorar_sesion uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT agenda_hay_conflicto(p_therapist_id, p_patient_id, p_inicio, p_fin,
                              p_ignorar_cita, p_ignorar_sesion)
      OR agenda_bloqueo_manual(p_therapist_id, p_inicio, p_fin)
$$;

REVOKE ALL ON FUNCTION public.hora_ocupada(uuid, uuid, timestamptz, timestamptz, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hora_ocupada(uuid, uuid, timestamptz, timestamptz, uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.enforce_appointment_agenda()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status NOT IN ('requested', 'confirmed') THEN
    RETURN NEW; -- cancelar o cerrar nunca puede chocar con nada
  END IF;

  PERFORM agenda_lock(NEW.therapist_id, NEW.patient_id);

  IF agenda_bloqueo_manual(NEW.therapist_id, NEW.starts_at, NEW.ends_at) THEN
    RAISE EXCEPTION 'AGENDA_BLOCKED: el profesional no atiende en esa fecha.';
  END IF;

  IF agenda_hay_conflicto(NEW.therapist_id, NEW.patient_id, NEW.starts_at, NEW.ends_at, NEW.id) THEN
    RAISE EXCEPTION 'AGENDA_CONFLICT: ese horario ya está ocupado en la agenda.';
  END IF;
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION public.enforce_session_agenda()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelada' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE'
     AND NEW.scheduled_at IS NOT DISTINCT FROM OLD.scheduled_at
     AND NEW.duration_minutes IS NOT DISTINCT FROM OLD.duration_minutes
     AND OLD.status <> 'cancelada' THEN
    RETURN NEW; -- no cambia de hueco
  END IF;

  PERFORM agenda_lock(NEW.therapist_id, NEW.patient_id);

  -- Una sesión que nace de una cita ya confirmada NO se comprueba contra los
  -- bloqueos: la cita pasó su propia comprobación al confirmarse, y bloquear
  -- después no puede invalidar retroactivamente lo ya acordado. Además el
  -- trigger de bloqueos impide crear uno encima de algo agendado.
  IF NEW.appointment_id IS NULL
     AND agenda_bloqueo_manual(NEW.therapist_id, NEW.scheduled_at,
                               NEW.scheduled_at + make_interval(mins => NEW.duration_minutes)) THEN
    RAISE EXCEPTION 'AGENDA_BLOCKED: tienes esa fecha bloqueada.';
  END IF;

  IF agenda_hay_conflicto(
       NEW.therapist_id, NEW.patient_id,
       NEW.scheduled_at, NEW.scheduled_at + make_interval(mins => NEW.duration_minutes),
       NEW.appointment_id, NEW.id) THEN
    RAISE EXCEPTION 'AGENDA_CONFLICT: ese horario ya está ocupado en la agenda.';
  END IF;
  RETURN NEW;
END
$$;

-- ============================================================================
-- 5. Reprogramar una cita YA confirmada
-- ============================================================================
--
-- `propose_new_time` solo aceptaba citas `requested`. El caso real que faltaba
-- es el otro: una cita confirmada que hay que mover.
--
-- No hace falta un mecanismo nuevo. Es el mismo: cancelar y crear otra enlazada.
-- Cancelar una confirmada arrastra su sesión a `cancelada` —ya lo hace
-- `materialize_session_on_confirm`— y libera el hueco, así que la propuesta
-- puede incluso caer sobre la hora original.
--
-- El paciente la acepta con la misma regla que ya existe: es una contraoferta
-- creada por el profesional. `starts_at` sigue sin tocarse en ningún momento.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.propose_new_time(
  p_appointment_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_message text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  original record;
  quien    uuid := auth.uid();
  nueva    uuid;
BEGIN
  IF quien IS NULL THEN
    RAISE EXCEPTION 'APPOINTMENT_FORBIDDEN: esta cita no es tuya.';
  END IF;

  SELECT * INTO original FROM appointments WHERE id = p_appointment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'APPOINTMENT_CHAIN_NOT_FOUND: esa solicitud no existe.';
  END IF;

  IF quien <> original.therapist_id THEN
    RAISE EXCEPTION 'APPOINTMENT_FORBIDDEN: esta cita no es tuya.';
  END IF;

  -- Solicitada o confirmada: las dos se pueden mover. Lo cerrado, no.
  IF original.status NOT IN ('requested', 'confirmed') THEN
    RAISE EXCEPTION 'APPOINTMENT_CLOSED: esta cita ya está cerrada.';
  END IF;

  UPDATE appointments SET status = 'cancelled' WHERE id = p_appointment_id;

  INSERT INTO appointments (
    relationship_id, patient_id, therapist_id, starts_at, ends_at,
    status, created_by, notes, replaces_appointment_id
  ) VALUES (
    original.relationship_id, original.patient_id, original.therapist_id,
    p_starts_at, p_ends_at, 'requested', quien,
    nullif(btrim(coalesce(p_message, '')), ''), p_appointment_id
  )
  RETURNING id INTO nueva;

  RETURN nueva;
END
$$;

COMMENT ON FUNCTION public.propose_new_time(uuid, timestamptz, timestamptz, text) IS
  'Contraoferta y reprogramación: cancela la cita original —solicitada o confirmada— y crea otra enlazada, en la misma transacción.';

-- La versión de cuatro argumentos queda obsoleta: la nueva la sustituye con los
-- dos parámetros de exclusión al final, con valor por defecto. Convivir con la
-- antigua deja la llamada de cuatro argumentos AMBIGUA y PostgreSQL la rechaza.
DROP FUNCTION IF EXISTS public.hora_ocupada(uuid, uuid, timestamptz, timestamptz);
