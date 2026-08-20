-- ============================================================================
-- Completar la corrección del endurecimiento: los UPDATE que quedaron rotos.
--
-- ── El defecto, una sola vez y en cinco sitios ──────────────────────────────
--
-- El endurecimiento revocó SELECT y mantuvo UPDATE. PostgreSQL exige SELECT
-- sobre toda columna que se LEA durante un UPDATE, y el WHERE es una lectura.
-- Resultado: `UPDATE ... WHERE id = $1` devuelve 42501 y la operación entera se
-- rechaza antes de tocar nada.
--
-- `appointments` ya se corrigió (20260804b). Aquí van las cuatro restantes,
-- localizadas con una auditoría de `information_schema` en vez de a ojo.
--
-- ── Criterio: la columna mínima, no la tabla ────────────────────────────────
--
-- Se concede SELECT COLUMNA A COLUMNA, solo sobre lo que el WHERE necesita
-- leer. Ninguna concesión devuelve contenido: ni estados, ni fechas de sesión,
-- ni textos, ni con quién. La lectura real sigue pasando exclusivamente por las
-- funciones SECURITY DEFINER que filtran por auth.uid().
--
-- Columna por columna, y por qué:
--
--   patient_therapist.id            `cerrar()` hace UPDATE ... WHERE id
--   therapy_sessions.id             updateSessionStatus / updateSessionVideoLink
--   therapist_contact_requests.id   accept / reject / cancel
--   user_preferences.profile_id     el UPSERT necesita leer el destino del
--                                   ON CONFLICT para resolverlo
--   notifications.id                markAsRead: WHERE id
--   notifications.read_at           ambas: WHERE read_at IS NULL
--   notifications.user_id           markAllAsRead: WHERE user_id
--
-- `notifications` es la única que necesita tres columnas, y la única con coste
-- real de privacidad: con `user_id` y `read_at` visibles, alguien autenticado
-- puede contar cuántos avisos sin leer tiene cada identificador. No hay
-- contenido —ni título, ni tipo, ni recurso—, pero es metadato de actividad.
-- La forma de evitarlo es mover `markAllAsRead` a una función SECURITY DEFINER;
-- no se hace aquí porque este sprint no toca el Notification Center.
--
-- `journey_events` NO necesita nada: el cliente solo hace INSERT, que no lee
-- ninguna columna. Comprobado, no supuesto.
-- ============================================================================

GRANT SELECT (id)         ON public.patient_therapist          TO authenticated;
GRANT SELECT (id)         ON public.therapy_sessions           TO authenticated;
GRANT SELECT (id)         ON public.therapist_contact_requests TO authenticated;
GRANT SELECT (profile_id) ON public.user_preferences           TO authenticated;

GRANT SELECT (id, user_id, read_at) ON public.notifications    TO authenticated;
