-- ============================================================================
-- Sprint therapist_contact_requests RLS
--
-- Activa RLS con tres políticas: las dos partes leen, solo el paciente crea,
-- las dos partes escriben. Sin DELETE.
--
-- NOTA DE NOMENCLATURA: la columna del terapeuta se llama `therapist_profile_id`
-- —referencia a therapist_profiles(profile_id)—. No existe `therapist_id` en
-- esta tabla. Las políticas usan el nombre real.
--
-- QUÉ CIERRA — y conviene no inflarlo, porque es poco:
--
--   Medido con RLS apagado, leyendo columna a columna:
--
--     actor            id       patient_id  status   message
--     solicitante      1 f      42501       42501    42501
--     paciente ajeno   1 f      42501       42501    42501
--     terap. destino   1 f      42501       42501    42501
--     terap. ajeno     1 f      42501       42501    42501
--     admin            1 f      42501       42501    42501
--     anon             42501 permission denied — ACL, sin ningún grant
--
--   Lo único legible por cualquiera era `id`: un UUID opaco, y con él el
--   número de solicitudes. No quién, ni a quién, ni el estado, ni el texto.
--   Esas cuatro columnas las cierra la ACL POR COLUMNA, que no se toca.
--
--   Es la aportación más pequeña de todo el plan de RLS. Se aplica por
--   coherencia y defensa en profundidad, no porque hubiera una fuga grave.
--
-- QUÉ NO CIERRA, PORQUE YA ESTABA CERRADO — no atribuirle mérito a RLS:
--
--   enforce_contact_request_rules [DEFINER] es el control de autorización más
--   completo de la base. Medido sin RLS, con el actor emparejado con su
--   solicitud:
--
--     alta a nombre ajeno ................ CONTACT_REQUEST_FORBIDDEN
--     alta ya aceptada ................... CONTACT_REQUEST_INVALID_INITIAL_STATUS
--     solicitante cancela la suya ........ PASA
--     solicitante se auto-acepta ......... CONTACT_REQUEST_PATIENT_CAN_ONLY_CANCEL
--     paciente ajeno cancela ............. CONTACT_REQUEST_FORBIDDEN
--     terapeuta ajeno acepta ............. CONTACT_REQUEST_FORBIDDEN
--     admin acepta ....................... CONTACT_REQUEST_FORBIDDEN
--     terapeuta destinatario acepta ...... PASA (+ crea la relación)
--     terapeuta cancela .................. CONTACT_REQUEST_THERAPIST_CAN_ONLY_RESOLVE
--     reabrir una cerrada ................ CONTACT_REQUEST_CLOSED    (también service_role)
--     borrar ............................. CONTACT_REQUEST_APPEND_ONLY (también service_role)
--
--   POR ESO ESTAS POLÍTICAS NO DUPLICAN LA MÁQUINA DE ESTADOS. Deciden SOBRE
--   QUÉ FILA se opera; el trigger decide QUÉ TRANSICIÓN es válida y para quién.
--
-- QUÉ NO TOCA:
-- ACL de tabla, ACL por columna (15 grants), triggers, funciones, RPC, FK
-- —incluida la entrante desde patient_therapist—, índices, vistas, Realtime,
-- datos, frontend ni ninguna otra tabla. FORCE no se activa.
--
-- Backup: supabase/backups/20260814_pre_therapist_contact_requests_rls.sql
-- Diagnóstico: contexto-proyecto/auditorias-tecnicas/Diagnostico_RLS_therapist_contact_requests_2026-08-14.md
--
-- Idempotente: cada política se elimina antes de crearse; ENABLE es idempotente.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Lectura: las dos partes de la solicitud.
--    El paciente ve las que envió; el terapeuta, las que recibió.
--
--    Ningún consumidor lee la tabla directamente —los cuatro van por RPC
--    SECURITY DEFINER—, así que esta política no habilita nada nuevo: cierra
--    la lectura del `id` ajeno, que era la única exposición.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Parties read their contact requests" ON public.therapist_contact_requests;
CREATE POLICY "Parties read their contact requests"
  ON public.therapist_contact_requests
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (auth.uid() = patient_id OR auth.uid() = therapist_profile_id);

-- ----------------------------------------------------------------------------
-- 2. Alta: solo el paciente solicitante, a nombre propio.
--    Consumidor: therapistContactService.ts:116 createContactRequest, que ya
--    toma el patient_id de la sesión y no de un parámetro.
--
--    El terapeuta NO puede crear solicitudes: no se le concede INSERT aquí, y
--    el trigger tampoco se lo permitiría.
--    Que la solicitud nazca en 'pending' lo sigue exigiendo el trigger
--    (CONTACT_REQUEST_INVALID_INITIAL_STATUS): no se duplica.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Patients create their own contact request" ON public.therapist_contact_requests;
CREATE POLICY "Patients create their own contact request"
  ON public.therapist_contact_requests
  AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = patient_id);

-- ----------------------------------------------------------------------------
-- 3. Resolución: las dos partes pueden alcanzar la fila.
--    Consumidor: therapistContactService.ts:95 cambiarEstado, único punto de
--    cambio de estado, usado por cancelar, aceptar y rechazar.
--
--    QUÉ puede hacer cada parte lo sigue decidiendo enforce_contact_request_rules:
--    el paciente solo 'cancelled', el terapeuta solo 'accepted'/'rejected', y
--    solo desde 'pending'. Esta política no lo repite.
--
--    Al aceptar, create_relationship_on_accept [DEFINER] crea la fila de
--    patient_therapist en la misma transacción. patient_therapist ya tiene RLS
--    y no se toca; el trigger es DEFINER, así que no le afecta.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Parties resolve their contact request" ON public.therapist_contact_requests;
CREATE POLICY "Parties resolve their contact request"
  ON public.therapist_contact_requests
  AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING (auth.uid() = patient_id OR auth.uid() = therapist_profile_id)
  WITH CHECK (auth.uid() = patient_id OR auth.uid() = therapist_profile_id);

-- ----------------------------------------------------------------------------
-- Sin política de DELETE: `authenticated` no tiene 'd' en la ACL, y
-- enforce_contact_request_no_delete lanza CONTACT_REQUEST_APPEND_ONLY incluso
-- para service_role. La tabla es append-only por diseño.
--
-- Sin política para anon: no tiene ningún privilegio.
-- Sin política para admin: no participa del flujo; el trigger ya se lo niega.
-- Sin política para service_role: tiene bypassrls.
-- ----------------------------------------------------------------------------

ALTER TABLE public.therapist_contact_requests ENABLE ROW LEVEL SECURITY;

COMMIT;

-- ============================================================================
-- REGLA 1 — el catálogo demuestra el estado final
-- ============================================================================
SELECT
  (SELECT relrowsecurity FROM pg_class
     WHERE oid = 'public.therapist_contact_requests'::regclass)                AS rls_activo,
  (SELECT relforcerowsecurity FROM pg_class
     WHERE oid = 'public.therapist_contact_requests'::regclass)                AS force_activo,
  (SELECT coalesce(array_to_string(reloptions, ','), '(NULL)') FROM pg_class
     WHERE oid = 'public.therapist_contact_requests'::regclass)                AS reloptions,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'therapist_contact_requests') AS politicas,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'therapist_contact_requests'
       AND cmd = 'SELECT')                                                     AS de_select,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'therapist_contact_requests'
       AND cmd = 'INSERT')                                                     AS de_insert,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'therapist_contact_requests'
       AND cmd = 'UPDATE')                                                     AS de_update,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'therapist_contact_requests'
       AND cmd = 'DELETE')                                                     AS de_delete,
  (SELECT count(*) FROM public.therapist_contact_requests)                     AS filas,
  (SELECT count(*) FROM pg_trigger
     WHERE tgrelid = 'public.therapist_contact_requests'::regclass
       AND NOT tgisinternal)                                                   AS triggers,
  (SELECT count(*) FROM information_schema.column_privileges
    WHERE table_schema = 'public' AND table_name = 'therapist_contact_requests'
      AND grantee = 'authenticated')                                           AS grants_columna,
  (SELECT count(*) FROM pg_constraint
    WHERE confrelid = 'public.therapist_contact_requests'::regclass
      AND contype = 'f')                                                       AS fk_entrantes,
  (SELECT count(*) FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity)       AS tablas_con_rls,
  (SELECT count(*) FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND c.relforcerowsecurity)                                               AS tablas_con_force,
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'public')               AS politicas_public;
