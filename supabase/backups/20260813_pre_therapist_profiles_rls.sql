-- ============================================================================
-- BACKUP DE REVERSIÓN — Sprint therapist_profiles RLS
-- Generado el 2026-08-13 a partir del catálogo real, no de memoria.
--
-- ESTADO CAPTURADO ANTES DE LA MIGRACIÓN (30 criterios confirmados uno a uno):
--
--   public.therapist_profiles
--     relrowsecurity      = FALSE
--     relforcerowsecurity = FALSE
--     reloptions          = NULL
--     owner               = postgres
--     políticas           = 0   (ninguna)
--     filas               = 1
--     huella de datos     = 5f6308f0935161d4b721aaf24cc1ac75
--       104db81c  "Terapeuta de Prueba"  lic=TP-000000  verified=true  active=true
--
--     ACL = postgres=arwdDxtm/postgres, service_role=arwdDxtm/postgres,
--           anon=r/postgres, authenticated=arw/postgres
--       -> anon r--- · authenticated raw- (SIN DELETE) · service_role rawd
--
--     trigger (1):
--       trg_therapist_profile_ownership -> enforce_therapist_profile_ownership [DEFINER]
--       BEFORE INSERT OR UPDATE
--       Aplica: propiedad (THERAPIST_PROFILE_FORBIDDEN) y reserva de `verified`
--       al admin (THERAPIST_PROFILE_VERIFIED_ADMIN_ONLY). NO se toca.
--
--     funciones que la mencionan (5, todas SECURITY DEFINER, ninguna se toca):
--       available_hours · enforce_appointment_rules · get_my_therapist
--       list_my_appointments · list_my_contact_requests
--
--     FK saliente (1):
--       profile_id -> profiles(id) ON DELETE CASCADE
--     FK entrantes (2):
--       patient_therapist.therapist_id            -> therapist_profiles(profile_id) CASCADE
--       therapist_contact_requests.therapist_profile_id -> therapist_profiles(profile_id) CASCADE
--
--     índices (3):
--       therapist_profiles_pkey                 UNIQUE (profile_id)
--       idx_therapist_profiles_directorio       btree (active, verified)
--       idx_therapist_profiles_specializations  gin (specializations)
--
--     CHECKs (3): bio <= 2000 · professional_name no vacío · years_experience >= 0
--     vistas que la proyectan: 0
--     Realtime (publicaciones): 0
--
--   Huellas globales del baseline:
--     ACL ........ c9a0182c86c1912385ee672d54f8c6c3
--     FK ......... cfb706920529fb9470ccbbf757a6537c
--     índices .... 6da61f8c851e3cf908ed5e2cb2d0e19a
--     triggers ... 3ca1288a327c51ad66d698009c86eb79
--     funciones .. e5e288e79a4b6f5b9364d7ffe902b7e1
--     vistas ..... 61114ef947d954eee83fcce7986cbd0a
--     estado RLS . ba6decb75147a35c4340debb896ddbcb
--     políticas .. b7c2843473ff1ffca2dadcd6a012358c
--
--   Estado global: 37 tablas · RLS 23/37 · FORCE 0/37 · 80 políticas
--
-- La tabla NO tenía ninguna política, así que el rollback no restaura ninguna:
-- solo elimina las tres que crea la migración. Es lo que dice el catálogo.
--
-- La migración NO toca ACL, triggers, funciones, FK, índices, vistas ni datos,
-- así que este backup no necesita restaurarlos: no hay nada que devolver.
-- ============================================================================

BEGIN;

-- 1. Desactivar RLS (el estado capturado era FALSE).
ALTER TABLE public.therapist_profiles DISABLE ROW LEVEL SECURITY;

-- 2. Eliminar las tres políticas que crea la migración.
DROP POLICY IF EXISTS "Anyone reads therapist profiles"                ON public.therapist_profiles;
DROP POLICY IF EXISTS "Therapists create their own professional profile" ON public.therapist_profiles;
DROP POLICY IF EXISTS "Owners and admins update professional profiles" ON public.therapist_profiles;

COMMIT;

-- ============================================================================
-- Comprobación posterior al rollback: debe devolver f, f, (NULL), 0, 1
-- y la huella de datos 5f6308f0935161d4b721aaf24cc1ac75
-- ============================================================================
-- SELECT relrowsecurity, relforcerowsecurity, reloptions FROM pg_class
--   WHERE oid = 'public.therapist_profiles'::regclass;
-- SELECT count(*) FROM pg_policies
--   WHERE schemaname = 'public' AND tablename = 'therapist_profiles';
-- SELECT count(*) FROM public.therapist_profiles;
-- ============================================================================
