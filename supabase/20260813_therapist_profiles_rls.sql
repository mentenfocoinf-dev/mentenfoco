-- ============================================================================
-- Sprint therapist_profiles RLS
--
-- Activa RLS sobre public.therapist_profiles con tres políticas.
--
-- QUÉ CIERRA — un solo hueco, y conviene decirlo con precisión:
--
--   El trigger enforce_therapist_profile_ownership comprueba
--   NEW.profile_id = auth.uid(), pero NO comprueba el ROL del actor. Medido
--   con RLS apagado, así que no es atribuible a RLS:
--
--     paciente crea el SUYO ........... SE CREA (verified=false, active=true)  NINGUNA capa
--     paciente pone su license_number . 1 fila                                 NINGUNA capa
--
--   Es decir: cualquier `authenticated` podía darse de alta como perfil
--   profesional, con el número de matrícula que quisiera. La fila entra en el
--   resultado SQL de listTherapists() (medido: 2 filas donde antes 1).
--
--   ALCANCE HONESTO: esa fila NO alcanza al paciente por la aplicación. El
--   único consumidor de listTherapists() es cargarPerfiles() en
--   matchingService.ts:221, y filtra .filter((t) => t.verified) en JS. No se
--   afirma nada sobre el render de ninguna pantalla: no se midió.
--
-- QUÉ NO CIERRA, PORQUE YA ESTABA CERRADO — no atribuirle mérito a RLS:
--
--   El trigger ya cortaba, con RLS apagado:
--     modificar el perfil AJENO ....... THERAPIST_PROFILE_FORBIDDEN
--     auto-verificarse ................ THERAPIST_PROFILE_VERIFIED_ADMIN_ONLY
--     cambiar el profile_id ........... THERAPIST_PROFILE_FORBIDDEN
--     crear a nombre ajeno ............ THERAPIST_PROFILE_FORBIDDEN
--     INSERT con verified=true ........ THERAPIST_PROFILE_FORBIDDEN
--   Y la ACL ya cortaba el DELETE (authenticated no tiene 'd').
--
--   La lectura es pública POR DISEÑO DE ACL (anon = r): es un directorio
--   profesional. RLS no añade nada ahí; la política 1 es paridad, no barrera.
--
-- QUÉ NO TOCA:
-- ACL, triggers, funciones, RPC, FK, índices, vistas, datos, frontend,
-- Realtime ni ninguna otra tabla. FORCE no se activa.
--
-- Backup: supabase/backups/20260813_pre_therapist_profiles_rls.sql
-- Diagnóstico: contexto-proyecto/auditorias-tecnicas/Diagnostico_RLS_therapist_profiles_2026-08-13.md
--
-- Idempotente: cada política se elimina antes de crearse; ENABLE es idempotente.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Lectura pública — PARIDAD EXACTA con el comportamiento actual.
--
--    No es una barrera: `anon` ya tiene SELECT por ACL y el directorio es
--    público por diseño. Esta política existe para que la tabla siga
--    funcionando con RLS activo, y porque el upsert la necesita:
--    INSERT ... ON CONFLICT DO UPDATE tiene que VER la fila en conflicto.
--
--    Demostrado por eliminación en el diagnóstico:
--      solo INSERT ............ upsert 42501
--      + UPDATE ............... upsert 42501
--      + SELECT ............... upsert OK
--
--    Consumidores: therapistService.ts:90 getTherapistProfile,
--    :141 listTherapists, y el .select(CAMPOS) del upsert de :115.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone reads therapist profiles" ON public.therapist_profiles;
CREATE POLICY "Anyone reads therapist profiles"
  ON public.therapist_profiles
  AS PERMISSIVE FOR SELECT
  TO anon, authenticated
  USING (true);

-- ----------------------------------------------------------------------------
-- 2. Alta: solo un terapeuta, y solo su propia fila.
--    ES LO ÚNICO QUE RLS APORTA EN ESTA TABLA.
--
--    La comprobación de rol es la que le falta al trigger. La de propiedad la
--    duplica a propósito, porque una política de INSERT sin `auth.uid() =
--    profile_id` dejaría pasar el alta a nombre ajeno hasta que el trigger la
--    cortase; así el orden de evaluación no importa.
--
--    Verificado en el diagnóstico:
--      paciente intenta darse de alta ...... 42501 (RLS)
--      terapeuta SIN fila previa se da alta . OK  -> el flujo legítimo no se rompe
--
--    Consumidor: therapistService.ts:115 updateTherapistProfile (upsert),
--    en su primera ejecución, cuando el terapeuta todavía no tiene perfil.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Therapists create their own professional profile" ON public.therapist_profiles;
CREATE POLICY "Therapists create their own professional profile"
  ON public.therapist_profiles
  AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = profile_id AND public.get_my_role() = 'therapist');

-- ----------------------------------------------------------------------------
-- 3. Edición: el titular o el administrador.
--
--    NECESARIA, no preventiva: sin ella el upsert de :115 falla cuando la fila
--    ya existe, que es el caso corriente de un terapeuta editando su perfil.
--
--    La rama de admin preserva una capacidad que el trigger YA concede —el
--    admin es el único que puede poner `verified`—. Sin ella, el admin pasaría
--    a 0 filas: medido. Se documenta que hoy NINGUNA pantalla la usa;
--    adminService.ts no toca `verified` y AdminDashboard no tiene UI de
--    verificación. Se preserva el backend, no una funcionalidad visible.
--
--    Qué NO decide esta política, porque ya lo decide el trigger: quién puede
--    tocar `verified`, y que `profile_id` es inmutable.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Owners and admins update professional profiles" ON public.therapist_profiles;
CREATE POLICY "Owners and admins update professional profiles"
  ON public.therapist_profiles
  AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING (auth.uid() = profile_id OR public.get_my_role() = 'admin')
  WITH CHECK (auth.uid() = profile_id OR public.get_my_role() = 'admin');

-- ----------------------------------------------------------------------------
-- Sin política de DELETE: ya lo corta la ACL (`authenticated` no tiene 'd').
-- No crearla es coherencia con el modelo, no la barrera real.
-- ----------------------------------------------------------------------------

ALTER TABLE public.therapist_profiles ENABLE ROW LEVEL SECURITY;

COMMIT;

-- ============================================================================
-- REGLA 1 — el catálogo demuestra el estado final
-- ============================================================================
SELECT
  (SELECT relrowsecurity FROM pg_class
     WHERE oid = 'public.therapist_profiles'::regclass)                  AS rls_activo,
  (SELECT relforcerowsecurity FROM pg_class
     WHERE oid = 'public.therapist_profiles'::regclass)                  AS force_activo,
  (SELECT coalesce(array_to_string(reloptions, ','), '(NULL)') FROM pg_class
     WHERE oid = 'public.therapist_profiles'::regclass)                  AS reloptions,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'therapist_profiles')   AS politicas,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'therapist_profiles'
       AND cmd = 'SELECT')                                               AS de_select,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'therapist_profiles'
       AND cmd = 'INSERT')                                               AS de_insert,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'therapist_profiles'
       AND cmd = 'UPDATE')                                               AS de_update,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'therapist_profiles'
       AND cmd = 'DELETE')                                               AS de_delete,
  (SELECT count(*) FROM public.therapist_profiles)                       AS filas,
  (SELECT count(*) FROM pg_trigger
     WHERE tgrelid = 'public.therapist_profiles'::regclass
       AND NOT tgisinternal)                                             AS triggers,
  (SELECT relrowsecurity FROM pg_class
     WHERE oid = 'public.messages'::regclass)                            AS messages_intacta,
  (SELECT count(*) FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity) AS tablas_con_rls,
  (SELECT count(*) FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND c.relforcerowsecurity)                                         AS tablas_con_force,
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'public')         AS politicas_public;
