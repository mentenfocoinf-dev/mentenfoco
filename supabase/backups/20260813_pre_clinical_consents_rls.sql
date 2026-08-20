-- ============================================================================
-- BACKUP DE REVERSIÓN — Sprint clinical_consents RLS
-- Generado el 2026-08-13 a partir del catálogo real, no de memoria.
--
-- ESTADO CAPTURADO ANTES DE LA MIGRACIÓN (29 criterios confirmados uno a uno):
--
--   public.clinical_consents
--     relrowsecurity      = FALSE
--     relforcerowsecurity = FALSE
--     reloptions          = NULL          <-- NULL, no 'false' ni cadena vacía
--     políticas           = 0   (ninguna)
--     filas               = 2   (0 revocados)
--     owner               = postgres
--     ACL                 = postgres=arwdDxtm/postgres,
--                           authenticated=arwm/postgres,
--                           service_role=arwdDxtm/postgres
--                           -> authenticated raw- : SIN DELETE (ya bloqueado por ACL)
--                           -> anon: ningún privilegio
--     huella de datos     = 4a5d575fc30dcbb3ef53ee84d44cd6bf
--                           (id:patient_id:version:accepted_at:revoked_at:created_at)
--
--     triggers (3):
--       trg_clinical_consent_authorship    -> enforce_clinical_consent_authorship  [DEFINER]
--       trg_clinical_consent_immutability  -> enforce_clinical_consent_immutability
--       trg_clinical_consent_no_delete     -> enforce_clinical_consent_no_delete
--
--     FK salientes (1):
--       FOREIGN KEY (patient_id) REFERENCES profiles(id) ON DELETE CASCADE
--     FK entrantes: 0
--
--     índices (3):
--       clinical_consents_pkey                  UNIQUE (id)
--       clinical_consents_patient_version_key   UNIQUE (patient_id, version)
--       clinical_consents_patient_idx           btree (patient_id)
--
--     vistas que la proyectan: 0
--     funciones / RPC / Edge Functions que la citan: 0
--
--   Huellas globales del baseline:
--     ACL ........ c9a0182c86c1912385ee672d54f8c6c3
--     FK ......... cfb706920529fb9470ccbbf757a6537c
--     índices .... 6da61f8c851e3cf908ed5e2cb2d0e19a
--     triggers ... 3ca1288a327c51ad66d698009c86eb79
--     funciones .. e5e288e79a4b6f5b9364d7ffe902b7e1
--     vistas ..... 61114ef947d954eee83fcce7986cbd0a
--     estado RLS . 64e08f70bec34e83738fa44c7136053c
--     políticas .. 31c92dd853c1ed10616a89c079223615
--
--   Estado global: 37 tablas · RLS 21/37 · 74 políticas
--   clinical_notes (sprint anterior, NO se toca aquí):
--     RLS true · 4 políticas · 24 filas · huella de datos 6abf5b4a764ffd5b7febae04c5ce355a
--
-- Como la tabla no tenía NINGUNA política, el rollback no restaura ninguna:
-- solo elimina las que crea la migración. Es lo que dice el catálogo.
--
-- La migración NO toca ACL, triggers, funciones, FK, índices, vistas ni datos,
-- así que este backup no necesita restaurarlos: no hay nada que devolver.
-- ============================================================================

BEGIN;

-- 1. Desactivar RLS (el estado capturado era FALSE).
ALTER TABLE public.clinical_consents DISABLE ROW LEVEL SECURITY;

-- 2. Eliminar las cinco políticas que crea la migración.
DROP POLICY IF EXISTS "Patients read their own consent"             ON public.clinical_consents;
DROP POLICY IF EXISTS "Therapists read consent of assigned patients" ON public.clinical_consents;
DROP POLICY IF EXISTS "Admins read all consents"                    ON public.clinical_consents;
DROP POLICY IF EXISTS "Patients record their own consent"           ON public.clinical_consents;
DROP POLICY IF EXISTS "Patients and admins update consent"          ON public.clinical_consents;

COMMIT;

-- ============================================================================
-- Comprobación posterior al rollback: debe devolver f, f, (NULL), 0, 2
-- y la huella de datos 4a5d575fc30dcbb3ef53ee84d44cd6bf
-- ============================================================================
-- SELECT relrowsecurity, relforcerowsecurity, reloptions FROM pg_class
--   WHERE oid = 'public.clinical_consents'::regclass;
-- SELECT count(*) FROM pg_policies
--   WHERE schemaname = 'public' AND tablename = 'clinical_consents';
-- SELECT count(*) FROM public.clinical_consents;
-- ============================================================================
