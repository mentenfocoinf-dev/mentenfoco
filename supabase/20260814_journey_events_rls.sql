-- ============================================================================
-- Sprint journey_events RLS
--
-- UNA sola política de INSERT. Ninguna más.
--
-- QUÉ CIERRA — y por una vez no es una fuga de lectura:
--
--   No hay nada que dejar de ver. Medido con RLS apagado, columna a columna:
--
--     actor            id      user_id  event_name  page    metadata  session_id
--     paciente A       42501   42501    42501       42501   42501     42501
--     paciente B       42501   42501    42501       42501   42501     42501
--     terapeuta        42501   42501    42501       42501   42501     42501
--     admin            42501   42501    42501       42501   42501     42501
--     anon             42501 permission denied for table journey_events
--
--   Ese 42501 es de ACL —`permission denied for table`—, no de RLS. Ni `anon` ni
--   `authenticated` tienen SELECT, y esta migración no se lo da.
--
--   Lo que estaba abierto era la ESCRITURA A NOMBRE DE OTRO:
--
--     paciente A escribe como paciente B ..... SE CREA
--     anon SIN SESIÓN escribe como terapeuta . SE CREA
--     anon retrodata created_at 400 días ..... SE CREA
--
--   Y llegaba a otra tabla. `notify_from_journey_event` [DEFINER] convierte un
--   NEXT_STEP_SHOWN en una fila de `notifications` usando NEW.user_id sin
--   comprobarlo:
--
--     anon inserta NEXT_STEP_SHOWN a nombre del terapeuta -> INSERT aceptado
--     notifications de ese usuario:  antes 2  ->  después 3
--     "NEXT_STEP_SHOWN | Tienes un paso pendiente | Continúa por donde lo
--      dejaste. | guia:ZZ-FALSO"
--
--   Un visitante sin sesión hacía aparecer una notificación real en la bandeja
--   de un profesional, y contaminaba su "siguiente paso" a través de las dos RPC.
--
-- POR QUÉ NO `WITH CHECK (true)`:
--
--   El diseño original (20260730g_journey_events.sql:139) dejó comentada una
--   política `journey_events_insert_todos ... WITH CHECK (true)`. Se midió en
--   simulación revertida: NO cierra nada. `anon` sigue escribiendo como el
--   terapeuta. La diferencia entre las dos variantes es todo el valor de esta
--   migración.
--
-- POR QUÉ NINGUNA POLÍTICA MÁS:
--
--   SELECT ... la ACL no lo concede a ningún rol de cliente. Una política sería
--            INERTE: no otorga privilegios, solo filtra los que ya existen.
--            Habilitarla exigiría GRANT SELECT a todo el rol `authenticated`, es
--            decir cambiar dos capas de defensa por una. Si el admin llega a
--            necesitar leer el recorrido, la vía es una RPC SECURITY DEFINER —el
--            patrón que esta tabla ya usa dos veces—.
--   UPDATE .. ACL sin 'w' para el cliente; trigger append-only para service_role.
--   DELETE .. ACL sin 'd' para el cliente; trigger append-only para service_role.
--   admin ... no es un actor distinto aquí: registra su propio recorrido con la
--            misma política que los demás.
--   service_role ... tiene bypassrls.
--
-- QUÉ SIGUE ABIERTO Y NO SE CORRIGE AQUÍ — está documentado, no disimulado:
--
--   · created_at es retrodatable. La política ata la IDENTIDAD del actor, no la
--     fecha. Sigue siendo posible insertar un evento propio con fecha inventada.
--   · H-JE-001: el trigger append-only es FOR EACH ROW y TRUNCATE no dispara
--     triggers de fila; `service_role` conserva 'D' y puede vaciar la tabla.
--     Medido. No es materia de RLS.
--   · Retención: la purga a 24 meses sigue pendiente desde julio, y lo que
--     retendría incluye 6 filas con `score` y `band` de tests.
--
-- QUÉ NO TOCA:
-- ACL de tabla, 51 grants por columna, los 2 triggers, las 2 RPC, la FK, los 6
-- índices, los 4 CHECK, vistas (0), Realtime (0), datos, frontend ni ninguna
-- otra tabla. FORCE no se activa.
--
-- Backup: supabase/backups/20260814_pre_journey_events_rls.sql
-- Diagnóstico: contexto-proyecto/auditorias-tecnicas/Diagnostico_RLS_journey_events_2026-08-14.md
--
-- Idempotente: la política se elimina antes de crearse; ENABLE es idempotente.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Cada quien registra su propio recorrido.
--
-- Consumidor: journeyService.ts:280, único acceso SQL directo del proyecto, con
-- 39 puntos de llamada. Envía `user_id: session?.user?.id ?? null` —nunca un
-- identificador ajeno—, y NO usa `.select()` ni RETURNING, así que esta política
-- de INSERT no arrastra necesidad de una de SELECT.
--
-- Las dos ramas del WITH CHECK:
--
--   user_id IS NULL ...... la telemetría anónima, que es el caso principal: 8
--                          rutas públicas (/, /blog, /contenido, /servicios,
--                          /tests, /contactanos, /membresia, /asesoramiento)
--                          escriben sin sesión. No se le impone un ownership
--                          que no existe.
--   auth.uid() = user_id . con sesión, el evento debe declarar a quien lo firma.
--
-- Para `anon`, auth.uid() es NULL, así que la segunda rama nunca se cumple: un
-- visitante solo puede escribir eventos sin dueño. Es exactamente lo que hace el
-- consumidor legítimo.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Everyone records their own journey" ON public.journey_events;
CREATE POLICY "Everyone records their own journey"
  ON public.journey_events
  AS PERMISSIVE FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    user_id IS NULL
    OR auth.uid() = user_id
  );

ALTER TABLE public.journey_events ENABLE ROW LEVEL SECURITY;

COMMIT;

-- ============================================================================
-- REGLA 1 — el catálogo demuestra el estado final
-- ============================================================================
SELECT
  (SELECT relrowsecurity FROM pg_class
     WHERE oid = 'public.journey_events'::regclass)                     AS rls_activo,
  (SELECT relforcerowsecurity FROM pg_class
     WHERE oid = 'public.journey_events'::regclass)                     AS force_activo,
  (SELECT coalesce(array_to_string(reloptions, ','), '(NULL)') FROM pg_class
     WHERE oid = 'public.journey_events'::regclass)                     AS reloptions,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'journey_events')      AS politicas,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'journey_events'
       AND cmd = 'INSERT')                                             AS de_insert,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'journey_events'
       AND cmd IN ('SELECT', 'UPDATE', 'DELETE'))                      AS de_sel_upd_del,
  (SELECT array_to_string(roles, ',') FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'journey_events')      AS roles,
  (SELECT with_check FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'journey_events')      AS with_check,
  (SELECT count(*) FROM public.journey_events)                          AS filas,
  (SELECT md5(string_agg(id::text, '|' ORDER BY id))
     FROM public.journey_events)                                        AS huella_datos,
  (SELECT count(*) FROM pg_trigger
     WHERE tgrelid = 'public.journey_events'::regclass
       AND NOT tgisinternal)                                            AS triggers,
  (SELECT count(*) FROM information_schema.column_privileges
    WHERE table_schema = 'public' AND table_name = 'journey_events'
      AND grantee IN ('anon', 'authenticated'))                         AS grants_columna,
  (SELECT count(*) FROM pg_index
     WHERE indrelid = 'public.journey_events'::regclass)                AS indices,
  (SELECT count(*) FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity) AS tablas_con_rls,
  (SELECT count(*) FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND c.relforcerowsecurity)                                        AS tablas_con_force,
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'public')        AS politicas_public;
