-- ============================================================================
-- BACKUP DE REVERSIÓN — Sprint therapist_contact_requests RLS
-- Generado el 2026-08-14 a partir del catálogo real, no de memoria.
--
-- ESTADO CAPTURADO ANTES DE LA MIGRACIÓN (28 criterios confirmados uno a uno):
--
--   public.therapist_contact_requests
--     relrowsecurity      = FALSE
--     relforcerowsecurity = FALSE
--     reloptions          = NULL
--     owner               = postgres
--     políticas           = 0   (ninguna)
--     filas               = 0   (TABLA VACÍA: no hay huella de datos que guardar)
--     triggers            = 5
--     FK salientes        = 2   ·   FK entrantes = 1
--     índices             = 4   ·   vistas dependientes = 0
--     Realtime/Broadcast  = 0
--     funciones de public que la citan = 3
--
--   ACL DE TABLA:
--     postgres=arwdDxtm/postgres, service_role=arwdDxtm/postgres,
--     authenticated=aw/postgres        -> anon: SIN NINGÚN PRIVILEGIO
--
--   ACL POR COLUMNA — 15 grants para authenticated, 0 para anon. NO se tocan:
--     columna                anon   authenticated
--     id                     —      INSERT + SELECT + UPDATE
--     patient_id             —      INSERT + UPDATE
--     therapist_profile_id   —      INSERT + UPDATE
--     status                 —      INSERT + UPDATE
--     message                —      INSERT + UPDATE
--     created_at             —      INSERT + UPDATE
--     updated_at             —      INSERT + UPDATE
--
--     -> authenticated escribe las 7 columnas y lee SOLO `id`. Sin DELETE.
--
--   triggers (los 5, no se tocan):
--     trg_contact_request_rules           BEFORE INSERT OR UPDATE -> enforce_contact_request_rules       [DEFINER]
--     trg_contact_request_no_delete       BEFORE DELETE           -> enforce_contact_request_no_delete   [INVOKER]
--     trg_create_relationship_on_accept   AFTER UPDATE            -> create_relationship_on_accept       [DEFINER]
--     trg_notify_contact_request_created  AFTER INSERT            -> notify_contact_request_created      [DEFINER]
--     trg_notify_contact_request_resolved AFTER UPDATE            -> notify_contact_request_resolved     [DEFINER]
--
--   funciones (no se tocan), las 3 SECURITY DEFINER:
--     get_contact_request(p_id) · list_my_contact_requests() · list_received_contact_requests()
--
--   FK salientes (2):
--     patient_id           -> profiles(id)                      ON DELETE CASCADE
--     therapist_profile_id -> therapist_profiles(profile_id)     ON DELETE CASCADE
--   FK ENTRANTE (1), válida y documentada, NO se toca:
--     patient_therapist.contact_request_id -> therapist_contact_requests(id) ON DELETE SET NULL
--
--   Huellas globales del baseline:
--     ACL ........ c9a0182c86c1912385ee672d54f8c6c3
--     FK ......... cfb706920529fb9470ccbbf757a6537c
--     índices .... 6da61f8c851e3cf908ed5e2cb2d0e19a
--     triggers ... 3ca1288a327c51ad66d698009c86eb79
--     funciones .. e5e288e79a4b6f5b9364d7ffe902b7e1
--     vistas ..... b23db2e27087288f50410d711cbf8de4
--     estado RLS . 0f05ef63fefc34898d1103185a6f45c6
--     políticas .. edc44689dd4f3758c2bc9538a7673881
--
--   Estado global: 37 tablas · RLS 27/37 · FORCE 0/37 · 88 políticas
--
-- Como la tabla no tenía NINGUNA política, el rollback no restaura ninguna:
-- solo elimina las tres que crea la migración.
--
-- La migración NO toca ACL de tabla, ACL por columna, triggers, funciones,
-- RPC, FK, índices, vistas, Realtime ni datos.
-- ============================================================================

BEGIN;

-- 1. Desactivar RLS (el estado capturado era FALSE).
ALTER TABLE public.therapist_contact_requests DISABLE ROW LEVEL SECURITY;

-- 2. Eliminar las tres políticas que crea la migración.
DROP POLICY IF EXISTS "Parties read their contact requests"        ON public.therapist_contact_requests;
DROP POLICY IF EXISTS "Patients create their own contact request"  ON public.therapist_contact_requests;
DROP POLICY IF EXISTS "Parties resolve their contact request"      ON public.therapist_contact_requests;

COMMIT;

-- ============================================================================
-- Comprobación posterior al rollback: debe devolver f, f, (NULL), 0, 0
-- ============================================================================
-- SELECT relrowsecurity, relforcerowsecurity, reloptions FROM pg_class
--   WHERE oid = 'public.therapist_contact_requests'::regclass;
-- SELECT count(*) FROM pg_policies
--   WHERE schemaname = 'public' AND tablename = 'therapist_contact_requests';
-- SELECT count(*) FROM public.therapist_contact_requests;
-- ============================================================================
