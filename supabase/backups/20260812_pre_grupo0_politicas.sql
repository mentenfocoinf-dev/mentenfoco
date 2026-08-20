-- ============================================================================
-- BACKUP DE REVERSION · Grupo 0 — preparacion de politicas RLS
-- Fecha: 12 de agosto de 2026
--
-- Estado capturado del catalogo ANTES de la migracion
-- `20260812_grupo0_preparacion_politicas.sql`:
--   48 politicas en el esquema `public`, sobre 18 tablas.
--   Huella md5 del conjunto: 54c965805a8a48071e58a4794b83d352
--   Huella md5 de la ACL de las 37 tablas: 64cdb69b1241ea34ac996556da08dc19
--   RLS: 0 de 37 tablas. Este backup NO activa RLS y NO debe activarlo.
--
-- Ejecutar este archivo completo devuelve las 48 politicas exactamente al
-- estado previo: nombres, permisividad, operacion, roles, USING y WITH CHECK.
-- Cada bloque hace DROP IF EXISTS + CREATE, por lo que es idempotente y puede
-- ejecutarse tantas veces como haga falta.
--
-- Generado leyendo `pg_policies`, no transcrito a mano.
-- ============================================================================

DROP POLICY IF EXISTS "Permitir lectura de cie11_directory a usuarios autenticados" ON public.cie11_directory;
CREATE POLICY "Permitir lectura de cie11_directory a usuarios autenticados" ON public.cie11_directory
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can view all alerts" ON public.clinical_alerts;
CREATE POLICY "Admins can view all alerts" ON public.clinical_alerts
  AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::user_role)))));

DROP POLICY IF EXISTS "Patients can insert their own alerts" ON public.clinical_alerts;
CREATE POLICY "Patients can insert their own alerts" ON public.clinical_alerts
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = patient_id));

DROP POLICY IF EXISTS "Patients can view their own alerts" ON public.clinical_alerts;
CREATE POLICY "Patients can view their own alerts" ON public.clinical_alerts
  AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = patient_id));

DROP POLICY IF EXISTS "Therapists can insert alerts for assigned patients" ON public.clinical_alerts;
CREATE POLICY "Therapists can insert alerts for assigned patients" ON public.clinical_alerts
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((EXISTS ( SELECT 1
   FROM patient_therapist
  WHERE ((patient_therapist.therapist_id = auth.uid()) AND (patient_therapist.patient_id = clinical_alerts.patient_id)))));

DROP POLICY IF EXISTS "Therapists can view alerts of assigned patients" ON public.clinical_alerts;
CREATE POLICY "Therapists can view alerts of assigned patients" ON public.clinical_alerts
  AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM patient_therapist
  WHERE ((patient_therapist.therapist_id = auth.uid()) AND (patient_therapist.patient_id = clinical_alerts.patient_id)))));

DROP POLICY IF EXISTS "Patients read own documents" ON public.clinical_documents;
CREATE POLICY "Patients read own documents" ON public.clinical_documents
  AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = patient_id));

DROP POLICY IF EXISTS "Therapists manage their documents" ON public.clinical_documents;
CREATE POLICY "Therapists manage their documents" ON public.clinical_documents
  AS PERMISSIVE FOR ALL TO public
  USING ((auth.uid() = therapist_id));

DROP POLICY IF EXISTS "Guides readable by plan level" ON public.clinical_guides;
CREATE POLICY "Guides readable by plan level" ON public.clinical_guides
  AS PERMISSIVE FOR SELECT TO public
  USING (((plan_rank(min_plan) = 0) OR (get_my_plan_rank() >= plan_rank(min_plan)) OR (get_my_role() = ANY (ARRAY['admin'::user_role, 'therapist'::user_role]))));

DROP POLICY IF EXISTS "Anyone authenticated can read clinical prescriptions" ON public.clinical_prescriptions;
CREATE POLICY "Anyone authenticated can read clinical prescriptions" ON public.clinical_prescriptions
  AS PERMISSIVE FOR SELECT TO public
  USING ((auth.role() = 'authenticated'::text));

DROP POLICY IF EXISTS "Patients read own recommendations" ON public.clinical_recommendations;
CREATE POLICY "Patients read own recommendations" ON public.clinical_recommendations
  AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = patient_id));

DROP POLICY IF EXISTS "Therapists manage their recommendations" ON public.clinical_recommendations;
CREATE POLICY "Therapists manage their recommendations" ON public.clinical_recommendations
  AS PERMISSIVE FOR ALL TO public
  USING ((auth.uid() = therapist_id));

DROP POLICY IF EXISTS "Patients read own tasks" ON public.clinical_tasks;
CREATE POLICY "Patients read own tasks" ON public.clinical_tasks
  AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = patient_id));

DROP POLICY IF EXISTS "Patients update own task status" ON public.clinical_tasks;
CREATE POLICY "Patients update own task status" ON public.clinical_tasks
  AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = patient_id));

DROP POLICY IF EXISTS "Therapists manage their tasks" ON public.clinical_tasks;
CREATE POLICY "Therapists manage their tasks" ON public.clinical_tasks
  AS PERMISSIVE FOR ALL TO public
  USING ((auth.uid() = therapist_id));

DROP POLICY IF EXISTS "Admins manage leads" ON public.crm_leads;
CREATE POLICY "Admins manage leads" ON public.crm_leads
  AS PERMISSIVE FOR ALL TO public
  USING ((get_my_role() = 'admin'::user_role));

DROP POLICY IF EXISTS "Anyone can create a lead" ON public.crm_leads;
CREATE POLICY "Anyone can create a lead" ON public.crm_leads
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins manage CRM notes" ON public.crm_notes;
CREATE POLICY "Admins manage CRM notes" ON public.crm_notes
  AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::user_role)))));

DROP POLICY IF EXISTS "Admins manage guides" ON public.guides;
CREATE POLICY "Admins manage guides" ON public.guides
  AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::user_role)))));

DROP POLICY IF EXISTS "Users can read guides matching their plan" ON public.guides;
CREATE POLICY "Users can read guides matching their plan" ON public.guides
  AS PERMISSIVE FOR SELECT TO public
  USING ((( SELECT profiles.plan_type
   FROM profiles
  WHERE (profiles.id = auth.uid())) = ANY (allowed_plans)));

DROP POLICY IF EXISTS "Admins can view all anamnesis" ON public.patient_anamnesis;
CREATE POLICY "Admins can view all anamnesis" ON public.patient_anamnesis
  AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::user_role)))));

DROP POLICY IF EXISTS "Patients manage their own anamnesis" ON public.patient_anamnesis;
CREATE POLICY "Patients manage their own anamnesis" ON public.patient_anamnesis
  AS PERMISSIVE FOR ALL TO public
  USING ((auth.uid() = patient_id))
  WITH CHECK ((auth.uid() = patient_id));

DROP POLICY IF EXISTS "Therapists can view their patients anamnesis" ON public.patient_anamnesis;
CREATE POLICY "Therapists can view their patients anamnesis" ON public.patient_anamnesis
  AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM patient_therapist
  WHERE ((patient_therapist.therapist_id = auth.uid()) AND (patient_therapist.patient_id = patient_anamnesis.patient_id)))));

DROP POLICY IF EXISTS "Patients can update their prescription status" ON public.patient_prescriptions;
CREATE POLICY "Patients can update their prescription status" ON public.patient_prescriptions
  AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = patient_id))
  WITH CHECK ((auth.uid() = patient_id));

DROP POLICY IF EXISTS "Patients can view their assigned prescriptions" ON public.patient_prescriptions;
CREATE POLICY "Patients can view their assigned prescriptions" ON public.patient_prescriptions
  AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = patient_id));

DROP POLICY IF EXISTS "Therapists can assign prescriptions" ON public.patient_prescriptions;
CREATE POLICY "Therapists can assign prescriptions" ON public.patient_prescriptions
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = therapist_id));

DROP POLICY IF EXISTS "Therapists can view assigned prescriptions" ON public.patient_prescriptions;
CREATE POLICY "Therapists can view assigned prescriptions" ON public.patient_prescriptions
  AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = therapist_id));

DROP POLICY IF EXISTS "Admins manage all assignments" ON public.patient_therapist;
CREATE POLICY "Admins manage all assignments" ON public.patient_therapist
  AS PERMISSIVE FOR ALL TO public
  USING ((current_user_role() = 'admin'::text));

DROP POLICY IF EXISTS "Patients view own assignment" ON public.patient_therapist;
CREATE POLICY "Patients view own assignment" ON public.patient_therapist
  AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = patient_id));

DROP POLICY IF EXISTS "Therapists view own assignments" ON public.patient_therapist;
CREATE POLICY "Therapists view own assignments" ON public.patient_therapist
  AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = therapist_id));

DROP POLICY IF EXISTS "Admins read all profiles" ON public.profiles;
CREATE POLICY "Admins read all profiles" ON public.profiles
  AS PERMISSIVE FOR SELECT TO public
  USING ((get_my_role() = 'admin'::user_role));

DROP POLICY IF EXISTS "Admins update all profiles" ON public.profiles;
CREATE POLICY "Admins update all profiles" ON public.profiles
  AS PERMISSIVE FOR UPDATE TO public
  USING ((get_my_role() = 'admin'::user_role));

DROP POLICY IF EXISTS "Therapists read assigned patient profiles" ON public.profiles;
CREATE POLICY "Therapists read assigned patient profiles" ON public.profiles
  AS PERMISSIVE FOR SELECT TO public
  USING (is_therapist_of(id));

DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
CREATE POLICY "Users read own profile" ON public.profiles
  AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = id));

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles
  AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = id))
  WITH CHECK ((auth.uid() = id));

DROP POLICY IF EXISTS "Patients can insert their own evaluations" ON public.psychometric_evaluations;
CREATE POLICY "Patients can insert their own evaluations" ON public.psychometric_evaluations
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = patient_id));

DROP POLICY IF EXISTS "Patients can view their own evaluations" ON public.psychometric_evaluations;
CREATE POLICY "Patients can view their own evaluations" ON public.psychometric_evaluations
  AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = patient_id));

DROP POLICY IF EXISTS "Therapists can insert evaluations for assigned patients" ON public.psychometric_evaluations;
CREATE POLICY "Therapists can insert evaluations for assigned patients" ON public.psychometric_evaluations
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((auth.uid() = therapist_id) AND (EXISTS ( SELECT 1
   FROM patient_therapist
  WHERE ((patient_therapist.therapist_id = auth.uid()) AND (patient_therapist.patient_id = psychometric_evaluations.patient_id))))));

DROP POLICY IF EXISTS "Therapists can view evaluations of assigned patients" ON public.psychometric_evaluations;
CREATE POLICY "Therapists can view evaluations of assigned patients" ON public.psychometric_evaluations
  AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = therapist_id));

DROP POLICY IF EXISTS "Insert telemetry" ON public.telemetry_events;
CREATE POLICY "Insert telemetry" ON public.telemetry_events
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Select telemetry admins" ON public.telemetry_events;
CREATE POLICY "Select telemetry admins" ON public.telemetry_events
  AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::user_role)))));

DROP POLICY IF EXISTS "Admins can manage all sessions" ON public.therapy_sessions;
CREATE POLICY "Admins can manage all sessions" ON public.therapy_sessions
  AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::user_role)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::user_role)))));

DROP POLICY IF EXISTS "Patients can view their own sessions" ON public.therapy_sessions;
CREATE POLICY "Patients can view their own sessions" ON public.therapy_sessions
  AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = patient_id));

DROP POLICY IF EXISTS "Therapists can create sessions for assigned patients" ON public.therapy_sessions;
CREATE POLICY "Therapists can create sessions for assigned patients" ON public.therapy_sessions
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((auth.uid() = therapist_id) AND (EXISTS ( SELECT 1
   FROM patient_therapist
  WHERE ((patient_therapist.therapist_id = auth.uid()) AND (patient_therapist.patient_id = therapy_sessions.patient_id))))));

DROP POLICY IF EXISTS "Therapists can delete sessions of assigned patients" ON public.therapy_sessions;
CREATE POLICY "Therapists can delete sessions of assigned patients" ON public.therapy_sessions
  AS PERMISSIVE FOR DELETE TO public
  USING (((auth.uid() = therapist_id) AND (EXISTS ( SELECT 1
   FROM patient_therapist
  WHERE ((patient_therapist.therapist_id = auth.uid()) AND (patient_therapist.patient_id = therapy_sessions.patient_id))))));

DROP POLICY IF EXISTS "Therapists can update sessions of assigned patients" ON public.therapy_sessions;
CREATE POLICY "Therapists can update sessions of assigned patients" ON public.therapy_sessions
  AS PERMISSIVE FOR UPDATE TO public
  USING (((auth.uid() = therapist_id) AND (EXISTS ( SELECT 1
   FROM patient_therapist
  WHERE ((patient_therapist.therapist_id = auth.uid()) AND (patient_therapist.patient_id = therapy_sessions.patient_id))))))
  WITH CHECK (((auth.uid() = therapist_id) AND (EXISTS ( SELECT 1
   FROM patient_therapist
  WHERE ((patient_therapist.therapist_id = auth.uid()) AND (patient_therapist.patient_id = therapy_sessions.patient_id))))));

DROP POLICY IF EXISTS "Therapists can view sessions of assigned patients" ON public.therapy_sessions;
CREATE POLICY "Therapists can view sessions of assigned patients" ON public.therapy_sessions
  AS PERMISSIVE FOR SELECT TO public
  USING (((auth.uid() = therapist_id) AND (EXISTS ( SELECT 1
   FROM patient_therapist
  WHERE ((patient_therapist.therapist_id = auth.uid()) AND (patient_therapist.patient_id = therapy_sessions.patient_id))))));

DROP POLICY IF EXISTS "Users manage their own progress" ON public.user_guide_progress;
CREATE POLICY "Users manage their own progress" ON public.user_guide_progress
  AS PERMISSIVE FOR ALL TO public
  USING ((auth.uid() = user_id));
