-- ============================================================================
-- Sprint messages RLS
--
-- Activa RLS sobre public.messages con tres políticas de participante.
-- Es la última tabla de riesgo alto que quedaba sin RLS.
--
-- QUÉ CIERRA — medido con RLS apagado, así que no es atribuible a RLS:
--
--   paciente de la conversación .... 4 cuerpos    legítimo
--   terapeuta de la conversación ... 4 cuerpos    legítimo
--   paciente AJENO ................. 4 cuerpos    <<< FUGA
--   tercero sin relaciones ......... 4 cuerpos    <<< FUGA
--   admin .......................... 4 cuerpos    <<< se cierra por decisión de producto
--   anon ........................... 42501 permission denied (ACL)
--
--   Cualquier usuario con sesión leía el texto íntegro de una conversación
--   terapéutica ajena. Es el contenido más íntimo de la plataforma.
--
-- QUÉ NO CIERRA, PORQUE YA ESTABA CERRADO — no atribuirle mérito a RLS:
--
--   La escritura la cubren por completo los triggers, medido sin RLS:
--     paciente ajeno / tercero / admin, INSERT ... P0001 MESSAGE_FORBIDDEN
--     ídem, UPDATE ................................ P0001 MESSAGE_FORBIDDEN
--     participante editando el cuerpo ............. P0001 MESSAGE_IMMUTABLE
--     cualquiera, DELETE .......................... 42501 ACL
--   enforce_message_insert además FUERZA NEW.sender_id := auth.uid().
--
--   Por eso estas políticas NO duplican la lógica de los triggers: deciden
--   SOBRE QUÉ FILA se opera, no QUÉ operación es válida.
--
-- DECISIÓN DE PRODUCTO APLICADA: el admin NO lee los cuerpos.
--   Medido: 0 referencias a messages en AdminDashboard.tsx y en adminService.ts,
--   y las 4 RPC vivas filtran por auth.uid(). No existe consumidor: la
--   capacidad era implícita, no un requisito. Por eso NO hay política de admin.
--
-- EFECTO SOBRE REALTIME — la razón por la que la política de SELECT es
-- obligatoria y no opcional:
--
--   realtime.apply_rls, leído del catálogo, decide así:
--     if not is_rls_enabled or action = 'DELETE' then
--         visible_role_sub_ids = ... || subscription_id;      -- todos reciben
--     else
--         perform set_config('role', working_role, true),
--                 set_config('request.jwt.claims', claims::text, true);
--         execute 'execute walrus_rls_stmt' into subscription_has_access;
--         if subscription_has_access then ...                 -- solo si RLS deja
--
--   Con RLS activo, Realtime asume el rol y los claims del suscriptor y prueba
--   la fila contra las políticas. SIN política de SELECT, las 4 suscripciones
--   postgres_changes se quedarían sin eventos EN SILENCIO. Con ella siguen
--   funcionando, porque las 4 filtran por patient_id o therapist_id, que es
--   exactamente lo que la política deja ver.
--
--   Precedente en este mismo proyecto: clinical_alerts está en la misma
--   publicación, con RLS y 3 políticas de SELECT desde el 12-ago.
--
--   El canal de Broadcast (broadcast_message_event -> realtime.send sobre
--   'user:'||uuid) es independiente y no se toca.
--
-- QUÉ NO TOCA:
-- ACL, triggers, funciones, RPC, FK, índices, vistas, datos, frontend,
-- publicaciones de Realtime ni ninguna otra tabla. FORCE no se activa.
--
-- Backup: supabase/backups/20260813_pre_messages_rls.sql
-- Diagnóstico: contexto-proyecto/auditorias-tecnicas/Diagnostico_RLS_messages_2026-08-13.md
--
-- Idempotente: cada política se elimina antes de crearse; ENABLE es idempotente.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Lectura: las dos partes de la conversación.
--
--    sender_id NO define quién puede leer: en una conversación de dos, quien
--    escribe y quien recibe ven lo mismo. La pertenencia ya está garantizada a
--    nivel de esquema por el CHECK messages_sender_is_participant.
--
--    Esta política sostiene tres cosas a la vez:
--      · el chat (aunque la lectura vaya por RPC, ver nota abajo);
--      · el RETURNING de sendMessageByPair:72, que usa .select("*").single();
--      · la entrega de eventos Realtime a las 4 suscripciones.
--
--    Nota honesta: las 4 RPC de lectura son SECURITY DEFINER de postgres, con
--    bypassrls. Esta política NO las gobierna — ni ellas la necesitan. Lo que
--    esta política cierra es el acceso DIRECTO .from("messages"), que es por
--    donde estaba la fuga.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Participants read their conversation" ON public.messages;
CREATE POLICY "Participants read their conversation"
  ON public.messages
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (auth.uid() = patient_id OR auth.uid() = therapist_id);

-- ----------------------------------------------------------------------------
-- 2. Envío: solo dentro de una conversación propia.
--    Consumidores: messagesService.ts:182 sendMessage (sin .select()) y
--    :72 sendMessageByPair (con .select("*").single()).
--
--    Quién figura como remitente lo sigue decidiendo enforce_message_insert,
--    que sobrescribe NEW.sender_id con auth.uid(). Esta política decide en qué
--    hilo se puede escribir.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Participants send in their conversation" ON public.messages;
CREATE POLICY "Participants send in their conversation"
  ON public.messages
  AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = patient_id OR auth.uid() = therapist_id);

-- ----------------------------------------------------------------------------
-- 3. Marcado de leído: solo dentro de una conversación propia.
--    Consumidores: messagesService.ts:217 markAsRead y
--    :92 markConversationAsReadByPair.
--
--    Qué columnas pueden cambiar lo sigue decidiendo enforce_message_update:
--    solo read_at; el cuerpo, el remitente, las dos partes, el hilo y
--    created_at son inmutables (MESSAGE_IMMUTABLE).
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Participants update their conversation" ON public.messages;
CREATE POLICY "Participants update their conversation"
  ON public.messages
  AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING (auth.uid() = patient_id OR auth.uid() = therapist_id)
  WITH CHECK (auth.uid() = patient_id OR auth.uid() = therapist_id);

-- ----------------------------------------------------------------------------
-- Sin política de DELETE: `authenticated` no tiene 'd' en la ACL y el trigger
-- enforce_message_no_delete (MESSAGE_APPEND_ONLY) es la red para service_role.
-- Hoy lo corta la ACL, no RLS; no crear la política es coherencia con el
-- modelo, no la barrera real.
--
-- Sin política para anon: no tiene ningún privilegio sobre la tabla.
-- Sin política para admin: decisión de producto aprobada.
-- Sin política para service_role: tiene bypassrls.
-- ----------------------------------------------------------------------------

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

COMMIT;

-- ============================================================================
-- REGLA 1 — el catálogo demuestra el estado final
-- ============================================================================
SELECT
  (SELECT relrowsecurity FROM pg_class
     WHERE oid = 'public.messages'::regclass)                            AS rls_activo,
  (SELECT relforcerowsecurity FROM pg_class
     WHERE oid = 'public.messages'::regclass)                            AS force_activo,
  (SELECT coalesce(array_to_string(reloptions, ','), '(NULL)') FROM pg_class
     WHERE oid = 'public.messages'::regclass)                            AS reloptions,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'messages')             AS politicas,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'messages'
       AND cmd = 'SELECT')                                               AS de_select,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'messages'
       AND cmd = 'INSERT')                                               AS de_insert,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'messages'
       AND cmd = 'UPDATE')                                               AS de_update,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'messages'
       AND cmd = 'DELETE')                                               AS de_delete,
  (SELECT count(*) FROM public.messages)                                 AS filas,
  (SELECT count(*) FROM pg_trigger
     WHERE tgrelid = 'public.messages'::regclass AND NOT tgisinternal)   AS triggers,
  (SELECT count(*) FROM pg_publication_rel pr JOIN pg_class c ON c.oid = pr.prrelid
    WHERE c.relname = 'messages')                                        AS publicaciones,
  (SELECT count(*) FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity) AS tablas_con_rls,
  (SELECT count(*) FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND c.relforcerowsecurity)                                         AS tablas_con_force,
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'public')         AS politicas_public;
