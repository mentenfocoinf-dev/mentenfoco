-- ============================================================================
-- Cerrar `push_notification` a los roles del navegador.
--
-- Alcance: UN solo cambio. Se revoca EXECUTE. No se toca el cuerpo de la
-- función, ni sus seis invocadores, ni ninguna tabla, ni RLS, ni React.
--
-- ── El problema, demostrado antes de escribir esto ──────────────────────────
--
-- `push_notification` es `SECURITY DEFINER` y no comprueba absolutamente nada:
--
--     IF p_user_id IS NULL THEN RETURN; END IF;
--     INSERT INTO notifications (...) VALUES (...);
--
-- Con `EXECUTE` concedido a `anon`, cualquiera puede insertar un aviso en el
-- centro de novedades de cualquier persona, con destinatario, título, cuerpo y
-- recurso elegidos. Ejecutado con `SET LOCAL ROLE anon` y rollback forzado:
--
--     notificaciones iniciales: 4
--     ACL: postgres=X/postgres | anon=X/postgres | authenticated=X/postgres | service_role=X/postgres
--     privilegio anon=true authenticated=true service_role=true
--     ANON INYECTA AVISO: SI (4 -> 5)
--     PACIENTE INYECTA AVISO: SI
--
-- El aviso inyectado decía «Tu terapeuta te ha escrito — Entra aquí:
-- http://sitio-falso», dentro de la interfaz de confianza de la plataforma y
-- dirigido a personas en tratamiento psicológico.
--
-- ── Por qué el REVOKE no rompe nada ────────────────────────────────────────
--
-- La función tiene seis invocadores y los seis son funciones de TRIGGER:
--
--     notify_appointment ................ appointments
--     notify_contact_request_created .... therapist_contact_requests
--     notify_contact_request_resolved ... therapist_contact_requests
--     notify_from_journey_event ......... journey_events
--     notify_message_sent ............... messages
--     notify_therapist_assigned ......... patient_therapist
--
-- Las seis son `SECURITY DEFINER` propiedad de `postgres`: se ejecutan con los
-- privilegios del propietario, no con los del rol que dispara el trigger. El
-- grant a `anon`/`authenticated` no participa en ninguna ruta legítima.
--
-- Y desde el frontend no se llama: búsqueda de `push_notification` en todo
-- `src` — cero coincidencias. Tampoco aparece en el inventario de las 37
-- llamadas `.rpc()` del proyecto.
--
-- ── Sobre PUBLIC ───────────────────────────────────────────────────────────
--
-- El `EXECUTE` NO llega por `PUBLIC`: `has_function_privilege('public', ...)`
-- devuelve false y la ACL muestra concesiones explícitas por rol. Un
-- `REVOKE ... FROM PUBLIC` no haría nada. Se revoca a los dos roles concretos.
--
-- ── Idempotencia ───────────────────────────────────────────────────────────
--
-- `REVOKE` sobre un privilegio ya revocado no es un error en PostgreSQL: no
-- hace nada y no avisa. Este archivo se puede ejecutar las veces que haga falta.
--
-- ── Reversión ──────────────────────────────────────────────────────────────
--
-- `supabase/backups/20260805_pre_push_notification.sql`
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public.push_notification(
  uuid, text, text, text, text, text, uuid
) FROM anon, authenticated;

COMMENT ON FUNCTION public.push_notification(uuid, text, text, text, text, text, uuid) IS
  'Ayudante interno de notificaciones. Solo la invocan funciones de trigger SECURITY DEFINER. NO conceder EXECUTE a anon ni a authenticated: sin comprobación de identidad, permite inyectar avisos a cualquier usuario.';
