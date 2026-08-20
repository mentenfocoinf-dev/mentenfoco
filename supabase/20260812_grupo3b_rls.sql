-- ============================================================================
-- GRUPO 3B — RLS en public.appointments.
--
-- UNA tabla, TRES politicas. Cierra el Grupo 3.
--
-- No toca ACL, `DEFAULT PRIVILEGES`, triggers, FK, funciones, RPC, columnas,
-- indices, datos ni React. Sin `FORCE RLS`. Ninguna otra tabla.
--
-- RLS pasa de 15 a 16 de 37. Politicas: 53 -> 56.
--
-- Reversion: `supabase/backups/20260812_pre_grupo3b_rls.sql`
--
--
-- ── Lo que hacia falta demostrar antes de escribir esto ─────────────────────
--
-- `appointments` tiene 6 triggers y el INSERT real NO envia `patient_id` ni
-- `therapist_id`, que son NOT NULL: los deriva `enforce_appointment_rules`
-- (BEFORE INSERT, SECURITY DEFINER) desde `relationship_id`:
--
--   NEW.patient_id   := rel.patient_id;
--   NEW.therapist_id := rel.therapist_id;
--   NEW.created_by   := auth.uid();     -- se sobreescribe lo que mande el cliente
--   NEW.status       := coalesce(NEW.status, 'requested');
--
-- La pregunta era si el `WITH CHECK` de una politica de INSERT llega a ver
-- esas columnas derivadas. **Si**, y esta medido sobre la tabla real dentro de
-- una transaccion revertida:
--
--   INSERT real sin RLS -> patient_id=141e54fe  therapist_id=104db81c
--                          created_by=141e54fe  status=requested
--   INSERT con la politica cuyo WITH CHECK usa patient_id -> OK
--
-- El `WITH CHECK` se evalua DESPUES de los triggers BEFORE. La politica puede
-- apoyarse en columnas derivadas.
--
--
-- ── Lo que cierra cada politica ─────────────────────────────────────────────
--
-- UPDATE  Sin ella, `appointmentService.ts:82` (cambiarEstado) devolveria
--         **0 filas sin error**: el mismo fallo mudo de `clinical_alerts` y
--         `patient_therapist`. Medido con RLS activo y sin politicas.
--
-- INSERT  Sin ella, `appointmentService.ts:120` daria `42501` y no se podria
--         pedir una cita.
--
-- SELECT  **No abre ninguna lectura hoy**: `authenticated` solo tiene SELECT
--         sobre la columna `id`, asi que leer columnas reales sigue dando
--         `42501` por ACL, con politica o sin ella. La lectura va por
--         `list_my_appointments()` y `list_therapist_appointments()`, ambas
--         SECURITY DEFINER con `bypassrls`.
--
--         Entra como proteccion preventiva, y por una razon medida: un
--         `INSERT ... RETURNING` exige politica de SELECT. Aislado:
--
--           INSERT SIN returning (lo que hace hoy el frontend) ... OK con 2 politicas
--           INSERT CON returning ................................. 42501 sin la de SELECT
--           INSERT CON returning + politica de SELECT ............ OK
--
--         `appointmentService.ts:120` hace `.insert({...})` sin `.select()`,
--         de modo que PostgREST manda `Prefer: return=minimal`. El dia que
--         alguien anada `.select()` para recuperar el id de la cita creada
--         —una linea, y lo natural—, el alta se romperia con `42501`. Esta
--         politica lo evita sin cambiar nada del comportamiento actual.
--
--
-- ── Lo que NO lleva, y por que ──────────────────────────────────────────────
--
-- DELETE ....... la ACL ya lo niega (`authenticated=aw`) **y** el trigger
--                `enforce_appointment_no_delete` lanza
--                `APPOINTMENT_APPEND_ONLY`. Una politica seria letra muerta.
-- anon ......... sin privilegios sobre la tabla: la ACL lo detiene antes de
--                que RLS entre en juego.
-- service_role . tiene `bypassrls`; una politica no se evaluaria nunca.
-- admin ........ no existe ningun consumidor de admin sobre `appointments`.
--                Hoy el trigger ya le impide crear citas
--                (`APPOINTMENT_FORBIDDEN`: no es parte de la relacion) y la
--                ACL de columna le impide leerlas. RLS no cambia nada de eso.
--
--
-- ── Lo que las politicas NO duplican ────────────────────────────────────────
--
-- `enforce_appointment_rules` sigue siendo quien decide las transiciones de
-- estado —el paciente solo cancela o acepta una contraoferta; el terapeuta
-- confirma, cancela, completa o marca no_show—, quien impide mover la hora
-- (`APPOINTMENT_IMMUTABLE`) y quien cierra lo terminado
-- (`APPOINTMENT_CLOSED`). Las politicas solo deciden **que filas alcanza cada
-- actor**; la maquina de estados se queda donde esta.
--
-- Los seis casos, medidos con las politicas puestas:
--
--   A  paciente, relationship_id propio ...... OK
--   B  paciente, relationship_id AJENO ....... APPOINTMENT_FORBIDDEN (trigger)
--   C  terapeuta, paciente asignado .......... OK
--   D  tercero, relacion ajena ............... APPOINTMENT_FORBIDDEN (trigger)
--   E  admin .................................. APPOINTMENT_FORBIDDEN (trigger)
--   F  anon ................................... 42501 (ACL)
--
--
-- ── Idempotencia ────────────────────────────────────────────────────────────
--
-- `ENABLE ROW LEVEL SECURITY` sobre una tabla que ya lo tiene activo no es un
-- error. Cada politica va precedida de su `DROP POLICY IF EXISTS`, limitado a
-- esta tabla. Sin `CASCADE`.
-- ============================================================================

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;


-- ─── UPDATE · appointmentService.ts:82 (cambiarEstado) ──────────────────────

DROP POLICY IF EXISTS "Parties change their own appointments" ON public.appointments;

CREATE POLICY "Parties change their own appointments"
  ON public.appointments
  AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = patient_id
    OR auth.uid() = therapist_id
  )
  WITH CHECK (
    auth.uid() = patient_id
    OR auth.uid() = therapist_id
  );


-- ─── INSERT · appointmentService.ts:120 ─────────────────────────────────────
-- El WITH CHECK se apoya en patient_id/therapist_id, que el trigger BEFORE
-- deriva desde relationship_id. Demostrado que llegan poblados.

DROP POLICY IF EXISTS "Parties request their own appointments" ON public.appointments;

CREATE POLICY "Parties request their own appointments"
  ON public.appointments
  AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = patient_id
    OR auth.uid() = therapist_id
  );


-- ─── SELECT · proteccion preventiva para un futuro .select()/RETURNING ──────

DROP POLICY IF EXISTS "Parties read their own appointments" ON public.appointments;

CREATE POLICY "Parties read their own appointments"
  ON public.appointments
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (
    auth.uid() = patient_id
    OR auth.uid() = therapist_id
  );
