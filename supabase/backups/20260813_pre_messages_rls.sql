-- ============================================================================
-- BACKUP DE REVERSIÓN — Sprint messages RLS
-- Generado el 2026-08-13 a partir del catálogo real, no de memoria.
--
-- ESTADO CAPTURADO ANTES DE LA MIGRACIÓN (26 criterios confirmados uno a uno):
--
--   public.messages
--     relrowsecurity      = FALSE
--     relforcerowsecurity = FALSE
--     reloptions          = NULL
--     owner               = postgres
--     políticas           = 0   (ninguna)
--     filas               = 4   (una sola conversación)
--     huella de datos     = 1f87312bbde81f5ec1bf55ca0c07f3ba
--     triggers            = 6
--     FK salientes        = 4   ·   FK entrantes = 0
--     índices             = 5   ·   vistas que la proyectan = 0
--     funciones de public que la citan = 4 (las 4 SECURITY DEFINER)
--     publicaciones Realtime = 2
--     ACL = postgres=arwdDxtm/postgres, authenticated=arwm/postgres,
--           service_role=arwdDxtm/postgres
--           -> anon SIN NINGÚN privilegio · authenticated raw- (SIN DELETE)
--
--     triggers (no se tocan):
--       trg_message_insert           BEFORE INSERT  -> enforce_message_insert       [DEFINER]
--       trg_message_update           BEFORE UPDATE  -> enforce_message_update       [DEFINER]
--       trg_message_no_delete        BEFORE DELETE  -> enforce_message_no_delete    [INVOKER]
--       trg_message_broadcast_insert AFTER INSERT   -> notify_message_broadcast_insert [DEFINER]
--       trg_message_broadcast_read   AFTER UPDATE   -> notify_message_broadcast_read   [DEFINER]
--       trg_notify_message_sent      AFTER INSERT   -> notify_message_sent          [DEFINER]
--
--     publicaciones (NO se tocan; la migración no altera Realtime):
--       supabase_realtime                     insert/update/delete/truncate
--       supabase_realtime_messages_publication insert/update/delete/truncate
--
--   Huellas globales del baseline:
--     ACL ........ c9a0182c86c1912385ee672d54f8c6c3
--     FK ......... cfb706920529fb9470ccbbf757a6537c
--     índices .... 6da61f8c851e3cf908ed5e2cb2d0e19a
--     triggers ... 3ca1288a327c51ad66d698009c86eb79
--     funciones .. e5e288e79a4b6f5b9364d7ffe902b7e1
--     políticas .. 8757768ba08f2e4f59b47f0ae694b393
--     estado RLS . a32ab273227b62c6c46f67b7f4350a25
--
--   Estado global: 37 tablas · RLS 25/37 · FORCE 0/37 · 83 políticas
--
-- Como la tabla no tenía NINGUNA política, el rollback no restaura ninguna:
-- solo elimina las tres que crea la migración. Es lo que dice el catálogo.
--
-- La migración NO toca ACL, triggers, funciones, RPC, FK, índices, vistas,
-- datos, frontend ni la configuración de Realtime, así que este backup no
-- necesita restaurarlos.
--
-- NOTA SOBRE REALTIME: al desactivar RLS, realtime.apply_rls vuelve a su rama
-- `not is_rls_enabled`, en la que toda suscripción que pase sus filtros recibe
-- el evento. Es decir: el rollback devuelve también el comportamiento de
-- entrega anterior, sin tocar ninguna publicación.
-- ============================================================================

BEGIN;

-- 1. Desactivar RLS (el estado capturado era FALSE).
ALTER TABLE public.messages DISABLE ROW LEVEL SECURITY;

-- 2. Eliminar las tres políticas que crea la migración.
DROP POLICY IF EXISTS "Participants read their conversation"   ON public.messages;
DROP POLICY IF EXISTS "Participants send in their conversation" ON public.messages;
DROP POLICY IF EXISTS "Participants update their conversation" ON public.messages;

COMMIT;

-- ============================================================================
-- Comprobación posterior al rollback: debe devolver f, f, (NULL), 0, 4
-- y la huella de datos 1f87312bbde81f5ec1bf55ca0c07f3ba
-- ============================================================================
-- SELECT relrowsecurity, relforcerowsecurity, reloptions FROM pg_class
--   WHERE oid = 'public.messages'::regclass;
-- SELECT count(*) FROM pg_policies
--   WHERE schemaname = 'public' AND tablename = 'messages';
-- SELECT count(*) FROM public.messages;
-- ============================================================================
