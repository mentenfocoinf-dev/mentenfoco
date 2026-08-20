-- ============================================================================
-- BACKUP DE REVERSIÓN — Sprint Clinical Notes RLS
-- Generado el 2026-08-13 a partir del catálogo real, no de memoria.
--
-- ESTADO CAPTURADO ANTES DE LA MIGRACIÓN (22 criterios confirmados uno a uno):
--
--   public.clinical_notes
--     relrowsecurity      = FALSE
--     relforcerowsecurity = FALSE
--     políticas           = 0   (ninguna)
--     filas               = 24  (las 24 firmadas)
--     owner               = postgres
--     ACL authenticated   = raw-   (SELECT, INSERT, UPDATE; SIN DELETE)
--     ACL anon            = ninguno
--     triggers            = 2  (tr_audit_clinical_notes,
--                               tr_check_clinical_note_immutability)
--     trigger de autoría  = 0  (no existe: es el hueco que cierra este sprint)
--     funciones que la citan = 0
--     vistas que la proyectan = 0
--
--   Huellas del baseline:
--     ACL ........ c9a0182c86c1912385ee672d54f8c6c3
--     políticas .. 6c93061ff28698cde7fe3432a604da47
--     FK ......... cfb706920529fb9470ccbbf757a6537c
--     índices .... 6da61f8c851e3cf908ed5e2cb2d0e19a
--     triggers ... 3ca1288a327c51ad66d698009c86eb79
--     funciones .. e5e288e79a4b6f5b9364d7ffe902b7e1
--     estado RLS . 77b8c091efbfa6db574746f61e3337d3
--     vistas ..... 61114ef947d954eee83fcce7986cbd0a
--
--   Estado global: 37 tablas · RLS 20/37 · 70 políticas
--
-- Como la tabla no tenía NINGUNA política, el rollback no restaura nada:
-- solo elimina lo que la migración crea. Es lo que dice el catálogo.
--
-- La migración NO toca ACL, triggers, funciones, FK, índices, vistas ni datos,
-- así que este backup no necesita restaurarlos.
-- ============================================================================

BEGIN;

-- 1. Desactivar RLS (el estado capturado era FALSE).
ALTER TABLE public.clinical_notes DISABLE ROW LEVEL SECURITY;

-- 2. Eliminar las cuatro políticas que crea la migración.
--    El estado capturado tenía 0 políticas: no se restaura ninguna.
DROP POLICY IF EXISTS "Therapists read notes of assigned patients"    ON public.clinical_notes;
DROP POLICY IF EXISTS "Admins read all clinical notes"                ON public.clinical_notes;
DROP POLICY IF EXISTS "Therapists create notes for assigned patients" ON public.clinical_notes;
DROP POLICY IF EXISTS "Authoring therapists update their own notes"   ON public.clinical_notes;

COMMIT;

-- ============================================================================
-- Comprobación posterior al rollback: debe devolver f, f, 0, 24
-- ============================================================================
-- SELECT relrowsecurity, relforcerowsecurity FROM pg_class
--   WHERE oid = 'public.clinical_notes'::regclass;
-- SELECT count(*) FROM pg_policies
--   WHERE schemaname = 'public' AND tablename = 'clinical_notes';
-- SELECT count(*) FROM public.clinical_notes;
-- ============================================================================
