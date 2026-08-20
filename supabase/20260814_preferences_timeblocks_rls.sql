-- ============================================================================
-- Sprint RLS — user_preferences + therapist_time_blocks
--
-- El último sprint del plan de RLS. Dos tablas, 6 políticas, ningún REVOKE.
--
-- ────────────────────────────────────────────────────────────────────────────
-- ESTE SPRINT NO CIERRA NINGUNA FUGA. Conviene decirlo antes que nada.
--
--   A diferencia de content_items, clinical_notes, messages, journey_events,
--   test_scores o clinical_prescriptions, aquí NO había nada abierto. Medido:
--
--     user_preferences        ajeno INSERT/UPDATE ... P0001 trigger USER_PREFERENCES_FORBIDDEN
--                             DELETE ................ 42501 ACL
--                             themes/goal/availability 42501 ACL de columna
--     therapist_time_blocks   ajeno DELETE .......... P0001 trigger BLOCK_FORBIDDEN
--                             UPDATE ................ 42501 ACL
--                             starts_at/reason ...... 42501 ACL de columna
--                             anon .................. sin ningún privilegio
--
--   El trigger y la ACL ya cubrían todo. Lo único legible por un tercero era
--   `profile_id` en una y `id` + `therapist_id` en la otra: identificadores
--   opacos, la misma exposición que se cerró en notifications y en
--   therapist_contact_requests.
--
--   Lo que RLS sí aporta: cierra esa lectura, deja el modelo de propiedad
--   explícito y declarativo, y hace que la protección no dependa de que un
--   trigger siga existiendo. No es una corrección urgente: es el cierre
--   ordenado del plan.
--
-- NO SE HACE NINGÚN REVOKE, y es deliberado: las dos ACL ya son mínimas
-- —`-aw-----` y `-a-d----`, sin SELECT de tabla, y `anon` sin nada—. Es la
-- diferencia con el sprint anterior, donde el REVOKE era la corrección de fondo.
--
-- ────────────────────────────────────────────────────────────────────────────
-- POR QUÉ LAS DOS LLEVAN POLÍTICA DE SELECT, Y NO ES OPCIONAL
--
--   En las dos tablas hay un consumidor real que ROMPERÍA EN SILENCIO sin ella,
--   y en las dos el fallo llegaría por un camino distinto:
--
--   1) user_preferences — preferencesService.ts:111 hace
--      `UPDATE ... .select("profile_id")`, es decir un RETURNING, y la LÓGICA
--      DEL SERVICIO depende de cuántas filas devuelve: si vuelven 0, intenta un
--      INSERT. Sin política de SELECT el RETURNING quedaría vacío y el servicio
--      insertaría contra su propia clave primaria.
--
--   2) therapist_time_blocks — timeBlocksService.ts:89 hace
--      `.delete().eq("id", id)`, es decir `DELETE ... WHERE id = X`. Postgres
--      necesita LEER esa fila para resolver el WHERE, y con RLS activo esa
--      lectura la gobiernan las políticas de SELECT. Medido, y aislado en tres
--      casos:
--
--        RLS + SOLO política de DELETE ............... 0 borradas  <<< NO BORRA
--        RLS + política de DELETE + política de SELECT  1 borrada
--        RLS + SOLO DELETE, y SIN cláusula WHERE ..... 1 borrada
--
--      El tercer caso lo confirma por contraste: sin WHERE no hace falta leer.
--      Y el fallo sería INVISIBLE: `deleteTimeBlock` solo comprueba
--      `if (error) throw`. El terapeuta pulsaría «eliminar», no vería error, y
--      el bloqueo seguiría en su agenda.
--
-- ────────────────────────────────────────────────────────────────────────────
-- QUÉ NO TOCA:
-- ACL de tabla, grants por columna, los dos triggers de propiedad, las 5
-- funciones SECURITY DEFINER, FK, índices, CHECK, vistas (0), Realtime (0),
-- datos (0 filas en ambas), frontend, RPC ni ninguna otra tabla. FORCE no se
-- activa. No se hace ningún REVOKE ni GRANT.
--
-- ESTADO FINAL: RLS 31 -> 33 de 37. Políticas: 92 -> 98.
--
-- Backup: supabase/backups/20260814_pre_preferences_timeblocks_rls.sql
-- Diagnóstico: contexto-proyecto/auditorias-tecnicas/Diagnostico_RLS_preferences_timeblocks_2026-08-14.md
--
-- Idempotente: cada política se elimina antes de crearse; ENABLE es idempotente.
-- ============================================================================

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════
-- user_preferences — una fila por persona, y la PK lo garantiza.
--
--   No hay `id` propio: `PRIMARY KEY (profile_id)`. El usuario ES la fila.
--   No es dato clínico —no hay severidad, diagnóstico ni puntaje— pero tampoco
--   es inocuo: saber que alguien entró pidiendo duelo y trauma dice bastante.
--
--   Trigger complementario: enforce_user_preferences_ownership [DEFINER], que
--   sigue siendo la autoridad. RLS filtra la fila ANTES de que llegue a él.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Lectura: solo el titular ─────────────────────────────────────────────
--    Imprescindible por el `.select("profile_id")` de preferencesService.ts:111.
--    La lectura de verdad —temas, objetivo, disponibilidad— va por
--    get_my_preferences() [DEFINER], que no se toca; la ACL de columna sigue
--    concediendo SELECT únicamente sobre `profile_id`.
DROP POLICY IF EXISTS "Users read their own preferences" ON public.user_preferences;
CREATE POLICY "Users read their own preferences"
  ON public.user_preferences
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (auth.uid() = profile_id);

-- ── 2. Alta: solo a nombre propio ───────────────────────────────────────────
--    Consumidor: preferencesService.ts:117, el INSERT del flujo de onboarding.
--    No es un upsert: `ON CONFLICT DO UPDATE` exigiría SELECT sobre cada columna
--    que escribe, y eso abriría la lectura de los temas. El servicio lo partió
--    en dos sentencias a propósito, y esta política respeta ese diseño.
DROP POLICY IF EXISTS "Users create their own preferences" ON public.user_preferences;
CREATE POLICY "Users create their own preferences"
  ON public.user_preferences
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = profile_id);

-- ── 3. Edición: solo la propia ──────────────────────────────────────────────
--    Consumidor: preferencesService.ts:111.
DROP POLICY IF EXISTS "Users update their own preferences" ON public.user_preferences;
CREATE POLICY "Users update their own preferences"
  ON public.user_preferences
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = profile_id)
  WITH CHECK (auth.uid() = profile_id);

-- Sin política de DELETE: `authenticated` no tiene 'd' en la ACL y ningún
-- consumidor borra preferencias. Sin admin: no lo pide nadie y el trigger ya se
-- lo niega. Sin anon: no tiene ningún privilegio.

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- ════════════════════════════════════════════════════════════════════════════
-- therapist_time_blocks — vacaciones y bloqueos del profesional.
--
--   Trigger complementario: enforce_time_block_ownership [DEFINER], que sigue
--   siendo la autoridad de negocio y NO se modifica ni se simplifica. Impone:
--     · NEW.therapist_id := auth.uid()      (deriva el dueño, no lo valida)
--     · BLOCK_FORBIDDEN si el DELETE no es del dueño
--     · BLOCK_IN_THE_PAST si el rango ya pasó
--     · BLOCK_OVERLAPS_AGENDA si pisa sesiones o citas vivas
--   RLS no duplica ninguna de esas reglas.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 4. Lectura: solo el dueño ───────────────────────────────────────────────
--    IMPRESCINDIBLE, y no por la lectura en sí —ningún consumidor hace SELECT
--    directo, listMyTimeBlocks va por RPC DEFINER— sino porque sin ella el
--    `DELETE ... WHERE id = X` de deleteTimeBlock() devuelve 0 filas EN SILENCIO.
--    Ver la nota de cabecera.
DROP POLICY IF EXISTS "Therapists read their own time blocks" ON public.therapist_time_blocks;
CREATE POLICY "Therapists read their own time blocks"
  ON public.therapist_time_blocks
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (auth.uid() = therapist_id);

-- ── 5. Alta: solo a nombre propio ───────────────────────────────────────────
--    DELIBERADAMENTE REDUNDANTE con trg_time_block_ownership, y aprobado así.
--
--    El BEFORE trigger corre ANTES del WITH CHECK, así que para cuando la
--    política evalúa la fila, `therapist_id` ya vale auth.uid(). Medido: un
--    paciente que envía el uuid del terapeuta acaba creando un bloqueo SUYO, y
--    el WITH CHECK lo deja pasar porque la fila ya es del actor.
--
--    Es decir: hoy esta política NO cierra nada que el trigger no cierre. Se
--    aplica para dejar el ownership explícito en RLS y para que la protección
--    sobreviva a un cambio futuro del trigger. La redundancia es intencional y
--    no se le atribuye mérito que no tiene.
DROP POLICY IF EXISTS "Therapists create their own time blocks" ON public.therapist_time_blocks;
CREATE POLICY "Therapists create their own time blocks"
  ON public.therapist_time_blocks
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = therapist_id);

-- ── 6. Borrado: solo el dueño ───────────────────────────────────────────────
--    Consumidor: timeBlocksService.ts:89 deleteTimeBlock(), que filtra por
--    `.eq("id", id)` y NO envía therapist_id. Con RLS, quien decide qué fila se
--    alcanza es esta política; el trigger sigue comprobando OLD.therapist_id.
DROP POLICY IF EXISTS "Therapists delete their own time blocks" ON public.therapist_time_blocks;
CREATE POLICY "Therapists delete their own time blocks"
  ON public.therapist_time_blocks
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (auth.uid() = therapist_id);

-- Sin política de UPDATE: `authenticated` no tiene 'w' en la ACL (es `ad`), así
-- que la rama de UPDATE del trigger ya era inalcanzable desde el cliente.
-- Sin admin, sin anon, sin service_role —este último tiene bypassrls y además
-- su propia rama en el trigger—.

ALTER TABLE public.therapist_time_blocks ENABLE ROW LEVEL SECURITY;

COMMIT;

-- ============================================================================
-- REGLA 1 — el catálogo demuestra el estado final
-- ============================================================================
SELECT
  (SELECT relrowsecurity FROM pg_class
     WHERE oid = 'public.user_preferences'::regclass)                    AS up_rls,
  (SELECT relforcerowsecurity FROM pg_class
     WHERE oid = 'public.user_preferences'::regclass)                    AS up_force,
  (SELECT coalesce(array_to_string(reloptions, ','), '(NULL)') FROM pg_class
     WHERE oid = 'public.user_preferences'::regclass)                    AS up_reloptions,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'user_preferences')     AS up_politicas,
  (SELECT string_agg(cmd || ':' || policyname || ':' || array_to_string(roles, ',')
                     || ':' || coalesce(qual, '-') || ':' || coalesce(with_check, '-'), ' | '
                     ORDER BY cmd)
     FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_preferences')      AS up_definiciones,
  (SELECT count(*) FROM public.user_preferences)                         AS up_filas,
  (SELECT relrowsecurity FROM pg_class
     WHERE oid = 'public.therapist_time_blocks'::regclass)               AS tb_rls,
  (SELECT relforcerowsecurity FROM pg_class
     WHERE oid = 'public.therapist_time_blocks'::regclass)               AS tb_force,
  (SELECT coalesce(array_to_string(reloptions, ','), '(NULL)') FROM pg_class
     WHERE oid = 'public.therapist_time_blocks'::regclass)               AS tb_reloptions,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'therapist_time_blocks') AS tb_politicas,
  (SELECT string_agg(cmd || ':' || policyname || ':' || array_to_string(roles, ',')
                     || ':' || coalesce(qual, '-') || ':' || coalesce(with_check, '-'), ' | '
                     ORDER BY cmd)
     FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'therapist_time_blocks') AS tb_definiciones,
  (SELECT count(*) FROM public.therapist_time_blocks)                    AS tb_filas,
  (SELECT array_to_string(relacl, ', ') FROM pg_class
     WHERE oid = 'public.user_preferences'::regclass)                    AS up_acl,
  (SELECT array_to_string(relacl, ', ') FROM pg_class
     WHERE oid = 'public.therapist_time_blocks'::regclass)               AS tb_acl,
  (SELECT count(*) FROM information_schema.column_privileges
    WHERE table_schema = 'public'
      AND table_name IN ('user_preferences', 'therapist_time_blocks')
      AND grantee = 'authenticated')                                     AS grants_columna,
  (SELECT count(*) FROM pg_trigger
     WHERE tgrelid IN ('public.user_preferences'::regclass,
                       'public.therapist_time_blocks'::regclass)
       AND NOT tgisinternal)                                             AS triggers,
  (SELECT count(*) FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity)  AS tablas_con_rls,
  (SELECT count(*) FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND c.relforcerowsecurity)                                         AS tablas_con_force,
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'public')         AS politicas_public;
