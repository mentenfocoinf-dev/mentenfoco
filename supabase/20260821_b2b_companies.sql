-- ============================================================================
-- Sprint B2B (Empresas) — MECANISMO INERTE. NO conectado a UI ni a flujo real.
--
-- ⚠️ EL CONSENTIMIENTO `employer_link_consents` REQUIERE REVISIÓN JURÍDICA.
--    Se construye el mecanismo (mismo patrón que el consentimiento clínico), pero
--    su TEXTO y su activación quedan PENDIENTES DE REVISIÓN LEGAL. Nada aquí se
--    conecta a producción hasta que el responsable confirme esa revisión. Las
--    tablas y la función pueden existir inertes en la base — es el patrón ya
--    usado con `clinical_consents`.
--
-- Decisiones (aprobadas 21-ago):
--   · Empresa como entidad propia (`companies`), estado de negociación/contrato
--     SIN precios (cotización manual fuera del sistema).
--   · Vínculo empleado↔empresa (`company_members`) que solo cuenta como
--     `vinculado` si tiene un consentimiento vigente.
--   · Consentimiento SEPARADO y revocable (`employer_link_consents`) — NUNCA
--     reutiliza `clinical_consents` (ADR-008).
--   · SIN rol `company_admin`: gestiona el admin de Mente en Foco. RLS admin-only
--     en `companies`; el paciente gestiona su propio vínculo/consentimiento.
--   · Métricas agregadas con **k-anonimato (umbral 5)**: por debajo de 5
--     vinculados no se revela cifra; NUNCA desagregado por persona ni actividad.
--
-- Backup: supabase/backups/20260821_pre_b2b_companies.sql
-- Idempotente: enums guardados por DO, tablas IF NOT EXISTS, políticas
--   DROP+CREATE, función CREATE OR REPLACE.
-- ============================================================================

BEGIN;

-- Enums (guardados: CREATE TYPE no admite IF NOT EXISTS) -----------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='company_status') THEN
    CREATE TYPE public.company_status AS ENUM ('prospecto','negociando','contrato_activo','pausado','cerrado');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='company_member_status') THEN
    CREATE TYPE public.company_member_status AS ENUM ('invitado','vinculado','desvinculado');
  END IF;
END $$;

-- Entidad empresa -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.companies (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  nit           text,                              -- identificación fiscal (CO)
  contact_name  text,
  contact_email text,
  contact_phone text,
  status        public.company_status NOT NULL DEFAULT 'prospecto',
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Consentimiento específico "vincular mi cuenta a mi empleador" ----------------
-- ⚠️ TEXTO PENDIENTE DE REVISIÓN JURÍDICA. Separado y revocable (ADR-008).
CREATE TABLE IF NOT EXISTS public.employer_link_consents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  version     integer NOT NULL DEFAULT 1,
  accepted_at timestamptz,
  revoked_at  timestamptz,                          -- revocar sella, no borra
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Vínculo empleado↔empresa ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  patient_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status      public.company_member_status NOT NULL DEFAULT 'invitado',
  consent_id  uuid REFERENCES public.employer_link_consents(id) ON DELETE SET NULL,
  linked_at   timestamptz,
  unlinked_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, patient_id)
);

-- RLS -------------------------------------------------------------------------
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employer_link_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.companies, public.employer_link_consents, public.company_members FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employer_link_consents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_members TO authenticated;

-- companies: solo admin de Mente en Foco.
DROP POLICY IF EXISTS "Admins manage companies" ON public.companies;
CREATE POLICY "Admins manage companies" ON public.companies FOR ALL TO authenticated
  USING (get_my_role() = 'admin') WITH CHECK (get_my_role() = 'admin');

-- employer_link_consents: el paciente es dueño de su consentimiento; admin lee.
DROP POLICY IF EXISTS "Patients own their employer consent" ON public.employer_link_consents;
CREATE POLICY "Patients own their employer consent" ON public.employer_link_consents FOR ALL TO authenticated
  USING (auth.uid() = patient_id OR get_my_role() = 'admin')
  WITH CHECK (auth.uid() = patient_id);

-- company_members: el paciente ve/gestiona su propio vínculo; admin gestiona todo.
DROP POLICY IF EXISTS "Members read own link or admin" ON public.company_members;
CREATE POLICY "Members read own link or admin" ON public.company_members FOR SELECT TO authenticated
  USING (auth.uid() = patient_id OR get_my_role() = 'admin');
DROP POLICY IF EXISTS "Patient revokes own link or admin manages" ON public.company_members;
CREATE POLICY "Patient revokes own link or admin manages" ON public.company_members FOR UPDATE TO authenticated
  USING (auth.uid() = patient_id OR get_my_role() = 'admin')
  WITH CHECK (auth.uid() = patient_id OR get_my_role() = 'admin');
DROP POLICY IF EXISTS "Admins insert links" ON public.company_members;
CREATE POLICY "Admins insert links" ON public.company_members FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = 'admin');
DROP POLICY IF EXISTS "Admins delete links" ON public.company_members;
CREATE POLICY "Admins delete links" ON public.company_members FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');

-- Métricas agregadas con k-anonimato (umbral 5). SECURITY DEFINER: cuenta sin
-- exponer filas individuales; NUNCA desagrega por persona ni por actividad.
CREATE OR REPLACE FUNCTION public.company_aggregate_metrics(p_company_id uuid)
 RETURNS TABLE(vinculados integer, activos_mes integer, suficiente boolean)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE k constant integer := 5; v integer; a integer;
BEGIN
  SELECT count(*) INTO v FROM public.company_members
    WHERE company_id = p_company_id AND status = 'vinculado';
  SELECT count(DISTINCT cm.patient_id) INTO a
    FROM public.company_members cm
    WHERE cm.company_id = p_company_id AND cm.status = 'vinculado'
      AND EXISTS (SELECT 1 FROM public.journey_events je
                  WHERE je.user_id = cm.patient_id AND je.created_at >= now() - interval '30 days');
  -- Bajo el umbral k, no se revela la cifra (evita reidentificación).
  IF v < k THEN
    RETURN QUERY SELECT NULL::integer, NULL::integer, false;
  ELSE
    RETURN QUERY SELECT v, a, true;
  END IF;
END
$function$;

-- Inerte: solo service_role la ejecuta por ahora (no hay UI). El grant de
-- ejecución al panel admin se decide cuando se construya, post-revisión legal.
REVOKE ALL ON FUNCTION public.company_aggregate_metrics(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.company_aggregate_metrics(uuid) TO service_role;

COMMIT;

-- ============================================================================
-- REGLA 1 — el catálogo demuestra el estado final
-- ============================================================================
SELECT
  (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('companies','company_members','employer_link_consents')) AS tablas_b2b,
  (SELECT bool_and(relrowsecurity) FROM pg_class WHERE oid IN ('public.companies'::regclass,'public.company_members'::regclass,'public.employer_link_consents'::regclass)) AS rls_todas,
  (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename IN ('companies','company_members','employer_link_consents')) AS politicas_b2b,
  (SELECT has_function_privilege('anon','public.company_aggregate_metrics(uuid)','EXECUTE')) AS anon_exec,
  (SELECT has_function_privilege('service_role','public.company_aggregate_metrics(uuid)','EXECUTE')) AS sr_exec,
  (SELECT has_table_privilege('anon','public.companies','SELECT')) AS anon_companies,
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r') AS tablas_base,
  (SELECT count(*) FROM pg_policies WHERE schemaname='public') AS politicas_total,
  (SELECT count(*) FROM pg_type WHERE typtype='e' AND typnamespace='public'::regnamespace) AS enums;
