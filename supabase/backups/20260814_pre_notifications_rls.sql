-- ============================================================================
-- BACKUP DE REVERSIÓN — Sprint notifications RLS
-- Generado el 2026-08-14 a partir del catálogo real, no de memoria.
--
-- ESTADO CAPTURADO ANTES DE LA MIGRACIÓN (26 criterios confirmados uno a uno):
--
--   public.notifications
--     relrowsecurity      = FALSE
--     relforcerowsecurity = FALSE
--     reloptions          = NULL
--     owner               = postgres
--     políticas           = 0   (ninguna)
--     filas               = 4   (2 destinatarios, las 4 sin leer)
--     huella de datos     = a3b7939863508234c0a41b424e355168
--     triggers            = 1   ·   FK salientes = 2   ·   FK entrantes = 0
--     índices             = 4   ·   vistas dependientes = 0
--     Realtime/Broadcast  = 0   (ninguna publicación)
--     funciones de public que la citan = 3
--
--   ACL DE TABLA:
--     postgres=arwdDxtm/postgres, service_role=arwdDxtm/postgres,
--     authenticated=w/postgres        -> anon: SIN NINGÚN PRIVILEGIO
--     Es decir: authenticated tiene `--w-` a nivel de tabla. La lectura NO
--     viene de aquí, viene de los grants de columna de abajo.
--
--   ACL POR COLUMNA — el detalle que explica el modelo y que NO se toca:
--     columna            anon    authenticated
--     id                 —       SELECT + UPDATE
--     user_id            —       SELECT + UPDATE
--     read_at            —       SELECT + UPDATE
--     event_type         —       UPDATE
--     title              —       UPDATE
--     body               —       UPDATE
--     resource_type      —       UPDATE
--     resource_id        —       UPDATE
--     relationship_id    —       UPDATE
--     created_at         —       UPDATE
--
--     -> authenticated escribe 10 columnas y lee solo 3. Sin INSERT ni DELETE
--        en ninguna. `title` y `body` NUNCA estuvieron expuestos.
--
--   trigger (no se toca):
--     trg_notification_rules  BEFORE UPDATE -> enforce_notification_rules [DEFINER]
--       Congela las 9 columnas salvo read_at (NOTIFICATION_IMMUTABLE) y exige
--       OLD.user_id = auth.uid() (NOTIFICATION_FORBIDDEN), salvo para el sistema.
--
--   funciones (no se tocan), las 3 SECURITY DEFINER:
--     count_my_unread_notifications() · list_my_notifications(p_limit)
--     push_notification(...)  -> EXECUTE solo para service_role
--
--   FK salientes (2):
--     user_id         -> profiles(id)           ON DELETE CASCADE
--     relationship_id -> patient_therapist(id)  ON DELETE SET NULL
--
--   Huellas globales del baseline:
--     ACL ........ c9a0182c86c1912385ee672d54f8c6c3
--     FK ......... cfb706920529fb9470ccbbf757a6537c
--     índices .... 6da61f8c851e3cf908ed5e2cb2d0e19a
--     triggers ... 3ca1288a327c51ad66d698009c86eb79
--     funciones .. e5e288e79a4b6f5b9364d7ffe902b7e1
--     vistas ..... b23db2e27087288f50410d711cbf8de4
--     estado RLS . 3edb1438f2da1e3ec8ede39bb5c62e8a
--     políticas .. 013d98700e34194d7dd70e498affe45e
--
--   Estado global: 37 tablas · RLS 26/37 · FORCE 0/37 · 86 políticas
--
-- Como la tabla no tenía NINGUNA política, el rollback no restaura ninguna:
-- solo elimina las dos que crea la migración.
--
-- La migración NO toca ACL de tabla, ACL por columna, triggers, funciones,
-- RPC, FK, índices, vistas, Realtime ni datos: este backup no necesita
-- restaurarlos.
-- ============================================================================

BEGIN;

-- 1. Desactivar RLS (el estado capturado era FALSE).
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;

-- 2. Eliminar las dos políticas que crea la migración.
DROP POLICY IF EXISTS "Recipients read their own notifications"   ON public.notifications;
DROP POLICY IF EXISTS "Recipients update their own notifications" ON public.notifications;

COMMIT;

-- ============================================================================
-- Comprobación posterior al rollback: debe devolver f, f, (NULL), 0, 4
-- y la huella de datos a3b7939863508234c0a41b424e355168
-- ============================================================================
-- SELECT relrowsecurity, relforcerowsecurity, reloptions FROM pg_class
--   WHERE oid = 'public.notifications'::regclass;
-- SELECT count(*) FROM pg_policies
--   WHERE schemaname = 'public' AND tablename = 'notifications';
-- SELECT count(*) FROM public.notifications;
-- ============================================================================
