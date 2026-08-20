-- ============================================================================
-- Sprint notifications RLS
--
-- Activa RLS sobre public.notifications con dos políticas de destinatario.
--
-- QUÉ CIERRA — una sola cosa, y conviene no inflarla:
--
--   Medido con RLS apagado, leyendo columna a columna y nunca solo count(*):
--
--     actor          id      user_id  read_at   title    body
--     propietario    4 f     4 f      4 f       42501    42501
--     terapeuta      4 f     4 f      4 f       42501    42501
--     tercero        4 f     4 f      4 f       42501    42501
--     admin          4 f     4 f      4 f       42501    42501
--     anon           42501 permission denied — ACL, sin ningún grant
--
--   Cualquier usuario con sesión leía `id`, `user_id` y `read_at` de TODAS las
--   filas. Eso revela QUIÉN fue notificado, CUÁNTAS veces y SI lo ha leído. El
--   conjunto de user_id con MESSAGE_SENT es, en la práctica, la lista de
--   personas con conversación terapéutica activa.
--
--   ES UNA FUGA DE METADATOS, NO DE CONTENIDO. `title` y `body` NUNCA
--   estuvieron expuestos: los cierran los grants por columna, que este sprint
--   NO toca.
--
-- QUÉ NO CIERRA, PORQUE YA ESTABA CERRADO — no atribuirle mérito a RLS:
--
--     INSERT (cualquier actor) ........ 42501 permission denied     ACL
--     DELETE (cualquier actor) ........ 42501 permission denied     ACL
--     UPDATE de title / user_id ....... P0001 NOTIFICATION_IMMUTABLE  trigger
--     UPDATE de una fila ajena ........ P0001 NOTIFICATION_FORBIDDEN  trigger
--
--   `authenticated` tiene UPDATE sobre las 10 columnas pero SELECT sobre solo
--   3. Esa asimetría parece peligrosa y no lo es: enforce_notification_rules
--   la neutraliza congelando todo salvo read_at.
--
--   La creación sigue siendo responsabilidad exclusiva del sistema:
--   push_notification tiene EXECUTE solo para service_role (medido:
--   anon=false, authenticated=false) y la disparan 6 triggers de otras tablas.
--
-- QUÉ NO TOCA:
-- ACL de tabla, ACL por columna, triggers, funciones, RPC, FK, índices,
-- vistas, Realtime, datos, frontend ni ninguna otra tabla. FORCE no se activa.
--
-- Backup: supabase/backups/20260814_pre_notifications_rls.sql
-- Diagnóstico: contexto-proyecto/auditorias-tecnicas/Diagnostico_RLS_notifications_2026-08-13.md
--
-- Idempotente: cada política se elimina antes de crearse; ENABLE es idempotente.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Lectura: solo el destinatario.
--    ES LO ÚNICO QUE RLS APORTA EN ESTA TABLA.
--
--    No afecta a los consumidores de lectura: `list_my_notifications` y
--    `count_my_unread_notifications` son SECURITY DEFINER de postgres, con
--    bypassrls, y ya filtran por auth.uid() dentro de su cuerpo. Lo que esta
--    política cierra es el acceso DIRECTO .from("notifications"), que es por
--    donde estaba la fuga y que ningún consumidor usa para leer.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Recipients read their own notifications" ON public.notifications;
CREATE POLICY "Recipients read their own notifications"
  ON public.notifications
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 2. Marcado de leída: solo el destinatario.
--    Consumidores: notificationService.ts:58 markAsRead y :79 markAllAsRead,
--    ambos UPDATE directos de read_at, ninguno con .select().
--
--    Duplica lo que ya hace enforce_notification_rules. Es defensa en
--    profundidad deliberada: si el trigger se retirase, la barrera no
--    desaparecería con él. QUÉ columnas pueden cambiar lo sigue decidiendo el
--    trigger —solo read_at—; esta política decide SOBRE QUÉ FILA se escribe.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Recipients update their own notifications" ON public.notifications;
CREATE POLICY "Recipients update their own notifications"
  ON public.notifications
  AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Sin política de INSERT: `authenticated` no tiene el privilegio en ninguna
-- columna. Crearla sería inventar una necesidad que no existe.
-- Sin política de DELETE: ídem.
-- Sin política para anon: no tiene ningún privilegio sobre la tabla.
-- Sin política para admin: no hay consumidor administrativo, y el trigger ya
--   le impide tocar lo ajeno.
-- Sin política para service_role: tiene bypassrls.
-- ----------------------------------------------------------------------------

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

COMMIT;

-- ============================================================================
-- REGLA 1 — el catálogo demuestra el estado final
-- ============================================================================
SELECT
  (SELECT relrowsecurity FROM pg_class
     WHERE oid = 'public.notifications'::regclass)                       AS rls_activo,
  (SELECT relforcerowsecurity FROM pg_class
     WHERE oid = 'public.notifications'::regclass)                       AS force_activo,
  (SELECT coalesce(array_to_string(reloptions, ','), '(NULL)') FROM pg_class
     WHERE oid = 'public.notifications'::regclass)                       AS reloptions,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'notifications')        AS politicas,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'notifications'
       AND cmd = 'SELECT')                                               AS de_select,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'notifications'
       AND cmd = 'UPDATE')                                               AS de_update,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'notifications'
       AND cmd IN ('INSERT', 'DELETE'))                                  AS de_insert_delete,
  (SELECT count(*) FROM public.notifications)                            AS filas,
  (SELECT count(*) FROM pg_trigger
     WHERE tgrelid = 'public.notifications'::regclass
       AND NOT tgisinternal)                                             AS triggers,
  (SELECT count(*) FROM information_schema.column_privileges
    WHERE table_schema = 'public' AND table_name = 'notifications'
      AND grantee = 'authenticated')                                     AS grants_columna,
  (SELECT count(*) FROM pg_publication_rel pr JOIN pg_class c ON c.oid = pr.prrelid
    WHERE c.relname = 'notifications')                                   AS publicaciones,
  (SELECT count(*) FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity) AS tablas_con_rls,
  (SELECT count(*) FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND c.relforcerowsecurity)                                         AS tablas_con_force,
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'public')         AS politicas_public;
