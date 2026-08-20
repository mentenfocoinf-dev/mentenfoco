-- ============================================================================
-- SPRINT 1 — Cerrar `anon` sobre datos clínicos y de identidad.
--
-- Alcance estricto: solo se revocan privilegios de `anon` sobre ocho tablas.
--
--   NO se toca `authenticated`.
--   NO se activa RLS.
--   NO se modifican políticas.
--   NO se mueve nada a RPC.
--   NO se toca React.
--
-- ── Qué se cierra ───────────────────────────────────────────────────────────
--
-- `anon` es la clave que viaja en el paquete JavaScript de cada visita. Es
-- pública por diseño. Hoy tiene SELECT, INSERT, UPDATE, DELETE y TRUNCATE sobre
-- las ocho tablas de abajo. Demostrado con `SET LOCAL ROLE anon` y rollback:
--
--     anon LEE notas clinicas: 24 filas
--     anon LEE evaluaciones psicometricas: 40 filas
--     anon LEE anamnesis: 4 filas
--     anon LEE alertas de crisis: 2 filas
--     anon LEE correos de perfiles: 8
--     anon BORRA alertas de crisis: 2 filas
--     anon SE HACE ADMIN: 7 perfiles elevados
--
-- El TRUNCATE no se ejecutó ni con rollback —son historias clínicas y ya se
-- perdieron 358 filas de `journey_events` por un bloque mal cerrado—, pero
-- `has_table_privilege('anon', 'clinical_notes', 'TRUNCATE')` devolvía `true`.
--
-- ── Por qué esto no rompe nada ──────────────────────────────────────────────
--
-- Ninguna de las ocho se lee ni se escribe sin sesión. Comprobado ruta a ruta:
--
--   · `useAuth.fetchProfile` solo corre dentro de `if (session?.user)`.
--   · `guidesService.resolverViewerPlan` devuelve "free" y sale ANTES de
--     consultar `profiles` cuando no hay sesión.
--   · `anamnesis`, `completar-perfil`, `consentimiento` y `nueva-contrasena`
--     son rutas posteriores al login.
--   · El flujo de tests públicos escribe en `public_tests` y
--     `public_test_submissions`, que NO están en esta lista.
--   · `CssrsModal` y `PsychometricScaleModal` solo se montan desde
--     `PatientDashboard`. La referencia en `SignupModal` es un comentario.
--   · Las páginas públicas leen `content_items`, `blog_comments`,
--     `clinical_guides`, `cie11_directory` y `therapist_profiles`, ninguna aquí.
--
-- ── Reversión ───────────────────────────────────────────────────────────────
--
-- Al final del archivo, comentado, está el GRANT que devuelve el estado
-- anterior exacto. Un solo bloque, listo para pegar.
-- ============================================================================

-- 1. Identidad. Es la raíz: de `profiles.role` depende todo el control de
--    acceso, y `session_token`, `cedula` y `email` viven aquí.
REVOKE ALL ON public.profiles                 FROM anon;

-- 2. Historia clínica.
REVOKE ALL ON public.clinical_notes           FROM anon;
REVOKE ALL ON public.psychometric_evaluations FROM anon;
REVOKE ALL ON public.patient_anamnesis        FROM anon;
REVOKE ALL ON public.clinical_consents        FROM anon;

-- 3. Riesgo y seguimiento.
REVOKE ALL ON public.clinical_alerts          FROM anon;
REVOKE ALL ON public.mood_entries             FROM anon;
REVOKE ALL ON public.patient_prescriptions    FROM anon;

-- ── Reversión, si algo falla en producción ──────────────────────────────────
--
-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
--   ON public.profiles, public.clinical_notes, public.psychometric_evaluations,
--      public.patient_anamnesis, public.clinical_consents, public.clinical_alerts,
--      public.mood_entries, public.patient_prescriptions
--   TO anon;
