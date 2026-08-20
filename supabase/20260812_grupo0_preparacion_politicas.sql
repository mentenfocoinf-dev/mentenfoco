-- ============================================================================
-- GRUPO 0 — Preparacion de politicas para una futura activacion de RLS.
--
-- ESTA MIGRACION NO ACTIVA RLS. No contiene ningun
-- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` ni variante equivalente.
-- Al terminar, las 37 tablas de `public` siguen con RLS = FALSE.
--
-- Alcance: EXCLUSIVAMENTE `pg_policies`. No toca ACL, DEFAULT PRIVILEGES,
-- triggers, funciones, columnas, datos, RPC ni React.
--
-- Reversion: `supabase/backups/20260812_pre_grupo0_politicas.sql`
-- Estado previo: 48 politicas · md5 54c965805a8a48071e58a4794b83d352
-- ACL de las 37 tablas: 64cdb69b1241ea34ac996556da08dc19 (no debe cambiar)
--
-- ── BLOQUE 1 · las 8 politicas que hoy fallarian con 42501 ──────────────────
--
-- Las expresiones de una politica RLS se evaluan con los privilegios del
-- INVOCANTE, no del propietario de la tabla. Ocho politicas resuelven la
-- relacion terapeuta-paciente con un `EXISTS (SELECT 1 FROM patient_therapist
-- ...)`, y los sprints 4I-4N retiraron a `authenticated` el SELECT sobre esa
-- tabla. Medido ejecutando la expresion como `authenticated`:
--
--   EXISTS (SELECT 1 FROM patient_therapist ...)  ->  42501 permission denied
--   is_therapist_of(patient_id)                   ->  true
--   is_therapist_of(<paciente ajeno>)             ->  false
--   is_therapist_of(...) preguntado por el paciente -> false
--
-- No devolverian cero filas: devolverian ERROR. Se sustituye la subconsulta
-- por `public.is_therapist_of(uuid)`, que ya existe, es SECURITY DEFINER con
-- owner `postgres` y `search_path=public`, tiene EXECUTE para `authenticated`
-- y encapsula exactamente esa consulta. No se crea ninguna funcion nueva.
--
-- Las condiciones `auth.uid() = therapist_id` que acompanaban a la subconsulta
-- se conservan intactas: se sustituye solo la parte que fallaba.
--
-- ── BLOQUE 2 · clinical_prescriptions ───────────────────────────────────────
--
-- CORRECCION de lo afirmado en el informe del sprint 4Q, que la habia
-- clasificado como peligrosa y recomendaba borrarla. Es un error: la tabla
-- NO contiene datos de pacientes. Sus columnas son
-- `id, titulo, objetivo_clinico, instruccion_paciente` — sin `patient_id`,
-- sin `therapist_id` y sin ninguna FK saliente. Son 14 plantillas de
-- ejercicio terapeutico, y el frontend la consume en `getPrescriptionsCatalog()`.
-- La tabla que si vincula personas es `patient_prescriptions`, con FK hacia
-- esta y sus propias politicas por `patient_id` / `therapist_id`.
--
-- Borrar la politica habria roto el embed
-- `prescription:clinical_prescriptions (titulo, objetivo_clinico, ...)` de
-- `getPatientPrescriptions()`, con el que el paciente lee el titulo y la
-- instruccion de lo que le asignaron. Se CONSERVA, reescrita al idioma
-- correcto: `TO authenticated USING (true)` en vez de comprobar
-- `auth.role() = 'authenticated'` dentro de la expresion. Mismo efecto,
-- rol explicito, sin depender de la lectura de un claim del JWT.
--
-- ── BLOQUE 3 · las dos politicas de `guides` ────────────────────────────────
--
-- `guides` quedo sustituida por `clinical_guides` al construirse el modelo
-- editorial. Evidencia: `guides` tiene 0 filas y `clinical_guides` 20;
-- `guides` y `user_guide_progress` no aparecen ni una sola vez en `src/` ni en
-- las Edge Functions; ninguna funcion de `public` las menciona. Sin consumidor
-- real, sus dos politicas se eliminan. La TABLA no se toca —sigue existiendo,
-- con su FK desde `user_guide_progress`—: esto borra politicas, no tablas.
-- Cuando RLS se active sobre `guides`, quedara cerrada por defecto, que es lo
-- correcto para una tabla sin uso.
--
-- ── BLOQUE 4 · `roles = public` -> `TO authenticated` ───────────────────────
--
-- 47 de las 48 politicas apuntan a `public`, que incluye a `anon`. Una
-- politica pensada para un paciente con sesion no debe declararse para
-- `public`: hoy la contiene la ACL, pero el dia que se conceda un SELECT a
-- `anon` la politica lo dejaria pasar sin que nadie lo haya decidido.
--
-- NO se convierten todas. El criterio aplicado, tabla por tabla, es: se
-- convierte solo donde `anon` no tiene NINGUN privilegio sobre la tabla, de
-- modo que el cambio no puede alterar comportamiento alguno. Quedan
-- deliberadamente en `public` los flujos publicos legitimos:
--
--   * `clinical_guides` · "Guides readable by plan level" — `anon` tiene
--     SELECT y la expresion esta escrita para el: `plan_rank(min_plan) = 0`
--     deja ver las guias gratuitas del hub publico a quien no tiene sesion.
--   * `crm_leads` · "Anyone can create a lead" — `anon` tiene INSERT; es el
--     formulario publico de contacto.
--
-- `cie11_directory` no se toca: es la unica politica que ya estaba declarada
-- `TO authenticated`.
--
-- ── Idempotencia ────────────────────────────────────────────────────────────
--
-- `ALTER POLICY` es naturalmente idempotente: fijar el mismo cuerpo o el mismo
-- rol dos veces deja el mismo estado. `DROP POLICY IF EXISTS` no falla si la
-- politica ya no esta. Ejecutable las veces que haga falta.
-- ============================================================================


-- ─── BLOQUE 1 · sustituir la subconsulta que provoca 42501 ──────────────────

ALTER POLICY "Therapists can insert alerts for assigned patients"
  ON public.clinical_alerts
  WITH CHECK (public.is_therapist_of(patient_id));

ALTER POLICY "Therapists can view alerts of assigned patients"
  ON public.clinical_alerts
  USING (public.is_therapist_of(patient_id));

ALTER POLICY "Therapists can view their patients anamnesis"
  ON public.patient_anamnesis
  USING (public.is_therapist_of(patient_id));

ALTER POLICY "Therapists can insert evaluations for assigned patients"
  ON public.psychometric_evaluations
  WITH CHECK (auth.uid() = therapist_id AND public.is_therapist_of(patient_id));

ALTER POLICY "Therapists can view sessions of assigned patients"
  ON public.therapy_sessions
  USING (auth.uid() = therapist_id AND public.is_therapist_of(patient_id));

ALTER POLICY "Therapists can create sessions for assigned patients"
  ON public.therapy_sessions
  WITH CHECK (auth.uid() = therapist_id AND public.is_therapist_of(patient_id));

ALTER POLICY "Therapists can update sessions of assigned patients"
  ON public.therapy_sessions
  USING (auth.uid() = therapist_id AND public.is_therapist_of(patient_id))
  WITH CHECK (auth.uid() = therapist_id AND public.is_therapist_of(patient_id));

ALTER POLICY "Therapists can delete sessions of assigned patients"
  ON public.therapy_sessions
  USING (auth.uid() = therapist_id AND public.is_therapist_of(patient_id));


-- ─── BLOQUE 2 · catalogo de prescripciones: se conserva, con rol explicito ──

DROP POLICY IF EXISTS "Anyone authenticated can read clinical prescriptions"
  ON public.clinical_prescriptions;

-- Se retira tambien el nombre nuevo antes de crearlo: en la segunda pasada el
-- DROP de arriba ya no encuentra nada y el CREATE chocaria con 42710.
DROP POLICY IF EXISTS "Authenticated users read the prescription catalog"
  ON public.clinical_prescriptions;

CREATE POLICY "Authenticated users read the prescription catalog"
  ON public.clinical_prescriptions
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (true);


-- ─── BLOQUE 3 · retirar las dos politicas de la tabla `guides`, sin uso ─────

DROP POLICY IF EXISTS "Admins manage guides" ON public.guides;
DROP POLICY IF EXISTS "Users can read guides matching their plan" ON public.guides;


-- ─── BLOQUE 4 · acotar a `authenticated` donde `anon` no tiene privilegios ──

ALTER POLICY "Admins can view all alerts"                          ON public.clinical_alerts          TO authenticated;
ALTER POLICY "Patients can insert their own alerts"                ON public.clinical_alerts          TO authenticated;
ALTER POLICY "Patients can view their own alerts"                  ON public.clinical_alerts          TO authenticated;
ALTER POLICY "Therapists can insert alerts for assigned patients"  ON public.clinical_alerts          TO authenticated;
ALTER POLICY "Therapists can view alerts of assigned patients"     ON public.clinical_alerts          TO authenticated;

ALTER POLICY "Therapists manage their documents"                   ON public.clinical_documents       TO authenticated;
ALTER POLICY "Patients read own documents"                         ON public.clinical_documents       TO authenticated;

ALTER POLICY "Therapists manage their recommendations"             ON public.clinical_recommendations TO authenticated;
ALTER POLICY "Patients read own recommendations"                   ON public.clinical_recommendations TO authenticated;

ALTER POLICY "Therapists manage their tasks"                       ON public.clinical_tasks           TO authenticated;
ALTER POLICY "Patients read own tasks"                             ON public.clinical_tasks           TO authenticated;
ALTER POLICY "Patients update own task status"                     ON public.clinical_tasks           TO authenticated;

ALTER POLICY "Admins manage leads"                                 ON public.crm_leads                TO authenticated;
ALTER POLICY "Admins manage CRM notes"                             ON public.crm_notes                TO authenticated;

ALTER POLICY "Patients manage their own anamnesis"                 ON public.patient_anamnesis        TO authenticated;
ALTER POLICY "Admins can view all anamnesis"                       ON public.patient_anamnesis        TO authenticated;
ALTER POLICY "Therapists can view their patients anamnesis"        ON public.patient_anamnesis        TO authenticated;

ALTER POLICY "Therapists can assign prescriptions"                 ON public.patient_prescriptions    TO authenticated;
ALTER POLICY "Patients can view their assigned prescriptions"      ON public.patient_prescriptions    TO authenticated;
ALTER POLICY "Therapists can view assigned prescriptions"          ON public.patient_prescriptions    TO authenticated;
ALTER POLICY "Patients can update their prescription status"       ON public.patient_prescriptions    TO authenticated;

ALTER POLICY "Admins manage all assignments"                       ON public.patient_therapist        TO authenticated;
ALTER POLICY "Patients view own assignment"                        ON public.patient_therapist        TO authenticated;
ALTER POLICY "Therapists view own assignments"                     ON public.patient_therapist        TO authenticated;

ALTER POLICY "Admins read all profiles"                            ON public.profiles                 TO authenticated;
ALTER POLICY "Therapists read assigned patient profiles"           ON public.profiles                 TO authenticated;
ALTER POLICY "Users read own profile"                              ON public.profiles                 TO authenticated;
ALTER POLICY "Admins update all profiles"                          ON public.profiles                 TO authenticated;
ALTER POLICY "Users update own profile"                            ON public.profiles                 TO authenticated;

ALTER POLICY "Patients can insert their own evaluations"           ON public.psychometric_evaluations TO authenticated;
ALTER POLICY "Therapists can insert evaluations for assigned patients" ON public.psychometric_evaluations TO authenticated;
ALTER POLICY "Patients can view their own evaluations"             ON public.psychometric_evaluations TO authenticated;
ALTER POLICY "Therapists can view evaluations of assigned patients" ON public.psychometric_evaluations TO authenticated;

ALTER POLICY "Insert telemetry"                                    ON public.telemetry_events         TO authenticated;
ALTER POLICY "Select telemetry admins"                             ON public.telemetry_events         TO authenticated;

ALTER POLICY "Admins can manage all sessions"                      ON public.therapy_sessions         TO authenticated;
ALTER POLICY "Therapists can delete sessions of assigned patients" ON public.therapy_sessions         TO authenticated;
ALTER POLICY "Therapists can create sessions for assigned patients" ON public.therapy_sessions        TO authenticated;
ALTER POLICY "Patients can view their own sessions"                ON public.therapy_sessions         TO authenticated;
ALTER POLICY "Therapists can view sessions of assigned patients"   ON public.therapy_sessions         TO authenticated;
ALTER POLICY "Therapists can update sessions of assigned patients" ON public.therapy_sessions         TO authenticated;

ALTER POLICY "Users manage their own progress"                     ON public.user_guide_progress      TO authenticated;
