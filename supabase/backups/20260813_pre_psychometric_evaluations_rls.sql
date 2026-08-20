-- ============================================================================
-- BACKUP DE REVERSIÓN — Sprint psychometric_evaluations RLS
-- Generado el 2026-08-13 a partir del catálogo real, no de memoria.
--
-- ESTADO CAPTURADO ANTES DE LA MIGRACIÓN (33 criterios confirmados uno a uno):
--
--   public.psychometric_evaluations
--     relrowsecurity      = FALSE
--     relforcerowsecurity = FALSE
--     reloptions          = NULL
--     owner               = postgres
--     políticas           = 4   (2 SELECT, 2 INSERT; 0 UPDATE, 0 DELETE)
--     filas               = 40  · 4 pacientes · therapist_id NULL en las 40
--     ACL                 = postgres=arwdDxtm/postgres,
--                           authenticated=arwm/postgres,
--                           service_role=arwdDxtm/postgres
--     huella de datos     = 49af9f2478dfb36ebbf6df1516dedcae
--
--     trigger (1):
--       free_plan_evaluation_limit -> enforce_free_plan_evaluation_limit [INVOKER]
--     FK salientes (2):
--       patient_id   -> profiles(id) ON DELETE CASCADE
--       therapist_id -> profiles(id) ON DELETE CASCADE
--     FK entrante (1):
--       clinical_alerts.test_score_id -> psychometric_evaluations(id) ON DELETE CASCADE
--     índices (1): psychometric_evaluations_pkey UNIQUE (id)
--     vistas que la proyectan: 0
--     funciones que la citan: 1 (solo su propio trigger)
--
--   LAS 4 POLÍTICAS EXACTAS EN EL MOMENTO DEL BACKUP:
--     [INSERT] "Patients can insert their own evaluations"  {authenticated}
--                WITH CHECK (auth.uid() = patient_id)
--     [INSERT] "Therapists can insert evaluations for assigned patients"  {authenticated}
--                WITH CHECK ((auth.uid() = therapist_id) AND is_therapist_of(patient_id))
--     [SELECT] "Patients can view their own evaluations"  {authenticated}
--                USING (auth.uid() = patient_id)
--     [SELECT] "Therapists can view evaluations of assigned patients"  {authenticated}
--                USING (auth.uid() = therapist_id)          <-- LA QUE LA MIGRACIÓN CORRIGE
--
--   Huellas globales del baseline:
--     ACL ........ c9a0182c86c1912385ee672d54f8c6c3
--     políticas .. 0639bea232c6b660ca88d77b02947af9
--     FK ......... cfb706920529fb9470ccbbf757a6537c
--     índices .... 6da61f8c851e3cf908ed5e2cb2d0e19a
--     triggers ... 3ca1288a327c51ad66d698009c86eb79
--     funciones .. e5e288e79a4b6f5b9364d7ffe902b7e1
--     vistas ..... 61114ef947d954eee83fcce7986cbd0a
--     estado RLS . 486dbb58f0dd215b879e4f1bc837935d
--
--   Estado global: 37 tablas · RLS 22/37 · 79 políticas
--
-- ATENCIÓN — ESTE BACKUP ES DISTINTO DE LOS ANTERIORES.
-- En los sprints previos la tabla no tenía ninguna política y el rollback solo
-- borraba. Aquí la migración MODIFICA una política existente, así que este
-- backup tiene que RESTAURARLA con su expresión original, transcrita del
-- catálogo. Sin este paso, un rollback dejaría la tabla en un estado que nunca
-- existió.
--
-- La migración NO toca ACL, triggers, funciones, FK, índices, vistas ni datos.
-- ============================================================================

BEGIN;

-- 1. Desactivar RLS (el estado capturado era FALSE).
ALTER TABLE public.psychometric_evaluations DISABLE ROW LEVEL SECURITY;

-- 2. Eliminar la política que la migración AÑADE.
DROP POLICY IF EXISTS "Admins read all evaluations" ON public.psychometric_evaluations;

-- 3. Restaurar la política de lectura del terapeuta a su expresión ORIGINAL.
--    La migración la sustituye por is_therapist_of(patient_id); aquí vuelve a
--    auth.uid() = therapist_id, que es lo que decía el catálogo.
DROP POLICY IF EXISTS "Therapists can view evaluations of assigned patients"
  ON public.psychometric_evaluations;
CREATE POLICY "Therapists can view evaluations of assigned patients"
  ON public.psychometric_evaluations
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (auth.uid() = therapist_id);

-- 4. Las otras tres políticas NO se tocan: la migración no las modifica, así
--    que no hay nada que restaurar.
--      "Patients can view their own evaluations"        (SELECT)
--      "Patients can insert their own evaluations"      (INSERT)
--      "Therapists can insert evaluations for assigned patients" (INSERT)

COMMIT;

-- ============================================================================
-- Comprobación posterior al rollback: debe devolver f, f, (NULL), 4, 40
-- y la huella de datos 49af9f2478dfb36ebbf6df1516dedcae
-- ============================================================================
-- SELECT relrowsecurity, relforcerowsecurity, reloptions FROM pg_class
--   WHERE oid = 'public.psychometric_evaluations'::regclass;
-- SELECT count(*) FROM pg_policies
--   WHERE schemaname = 'public' AND tablename = 'psychometric_evaluations';
-- SELECT count(*) FROM public.psychometric_evaluations;
-- ============================================================================
