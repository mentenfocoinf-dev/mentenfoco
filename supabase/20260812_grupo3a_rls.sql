-- ============================================================================
-- GRUPO 3A — RLS en las tres tablas de relacion.
--
--   public.profiles           -> RLS ON, con sus 5 politicas ya existentes
--   public.patient_therapist  -> RLS ON + 1 politica nueva de UPDATE
--   public.therapy_sessions   -> RLS ON, con sus 6 politicas ya existentes
--
-- `appointments` queda DELIBERADAMENTE FUERA: necesita 4 politicas nuevas y
-- una medicion previa del orden entre los triggers BEFORE y el WITH CHECK.
-- Es el Grupo 3B, con su propio backup y su propia bateria.
--
-- No toca ACL, `DEFAULT PRIVILEGES`, triggers, FK, funciones, RPC, columnas,
-- indices, datos ni React. Sin `FORCE RLS`.
--
-- RLS pasa de 12 a 15 de 37 tablas. Politicas: 52 -> 53.
--
-- Reversion: `supabase/backups/20260812_pre_grupo3a_rls.sql`
--
--
-- ── 1. profiles · la fuga que cierra ────────────────────────────────────────
--
-- Es la unica de las tres con una fuga de LECTURA viva. Medido con un paciente
-- sin relacion con nadie:
--
--   SELECT id, email, session_token, role FROM profiles
--     -> LEE los 8 perfiles completos. Seis tienen `session_token` no nulo.
--
-- Las tres politicas de SELECT que ya existen —propio, terapeuta asignado via
-- `is_therapist_of(id)`, admin via `get_my_role()`— cierran exactamente eso.
--
-- La ESCRITURA ya estaba protegida, y no por ACL sino por el trigger
-- `enforce_profile_ownership` (DEFINER): editar el nombre de otro devuelve
-- `PROFILE_FORBIDDEN`, crear un perfil ajeno tambien, y `role` esta cerrado
-- por ACL de columna —`authenticated` solo tiene UPDATE sobre 12 de las 21
-- columnas, no sobre `role`, `plan_type`, `email`, `session_token`,
-- `stripe_customer_id`, `subscription_status` ni `signup_source`.
--
-- ── profiles · el INSERT queda cerrado, y es intencional ────────────────────
--
-- `authenticated` tiene INSERT de tabla y `profiles` no tiene ninguna politica
-- de INSERT: al activar RLS, queda denegado. Decision aprobada del responsable
-- del producto, y comprobada antes de proponerla: **cero `INSERT` o `upsert`
-- sobre `profiles` en todo `src/`**. Los perfiles los crean
-- `public-signup`, `stripe-webhook` y `admin-create-user`, las tres con
-- `SERVICE_ROLE`, que tiene `bypassrls` y no se ve afectado.
--
-- No se crea politica de DELETE: la ACL ya lo niega (`authenticated=arm`).
--
--
-- ── 2. patient_therapist · el fallo silencioso que evita ────────────────────
--
-- Sus 3 politicas cubren SELECT (paciente y terapeuta) y ALL (admin), pero
-- NINGUNA cubre UPDATE para quien no sea admin. Y
-- `patientTherapistService.ts:75` hace exactamente un UPDATE: es como una de
-- las partes cierra la relacion terapeutica.
--
-- Sin la politica nueva, ese UPDATE devolveria **0 filas sin error** —el mismo
-- patron de fallo mudo que encontramos en `clinical_alerts`—. Con ella,
-- funciona para las dos partes y para nadie mas.
--
-- El trigger `enforce_patient_therapist_rules` sigue siendo quien impide
-- cambiar las partes de la relacion: la politica no lo duplica. Medido, un
-- tercero recibe hoy `RELATIONSHIP_FORBIDDEN` del trigger; la politica anade
-- que ademas no vea ni alcance la fila.
--
--
-- ── 3. therapy_sessions · el hueco que cierra ───────────────────────────────
--
-- Sus 6 politicas ya cubren todo y no hace falta ninguna nueva. Lo que aporta
-- activarlas es cerrar un hueco medido:
--
--   el TERAPEUTA crea una sesion para un paciente que NO es suyo
--     is_therapist_of(ajeno) = false
--     -> CREADA. Ni la ACL ni ningun trigger lo impiden.
--
-- La politica de INSERT —`auth.uid() = therapist_id AND
-- is_therapist_of(patient_id)`— lo cierra.
--
-- Su politica de DELETE queda como letra muerta: la ACL no concede DELETE a
-- `authenticated` desde el sprint 4L. No se toca.
--
--
-- ── Lo que RLS NO alcanza aqui, dicho explicitamente ────────────────────────
--
-- 26 funciones tocan `profiles`, 15 `patient_therapist` y 5
-- `therapy_sessions`. Todas son `SECURITY DEFINER` con owner `postgres`, que
-- tiene `bypassrls = true`. **RLS no protege esas rutas ni las rompera**: la
-- autorizacion de las RPC vive en su cuerpo. Es el mismo limite que midio el
-- sprint 4Q.
--
-- La lectura directa de `patient_therapist` y `therapy_sessions` ya estaba
-- cerrada por ACL de columna —`authenticated` solo puede leer `id`—, asi que
-- ahi RLS gobierna la escritura, no la lectura.
--
-- Las 45 FK entrantes de `profiles` no se ven afectadas: la comprobacion de
-- claves foraneas no pasa por RLS.
--
--
-- ── Idempotencia ────────────────────────────────────────────────────────────
--
-- `ENABLE ROW LEVEL SECURITY` sobre una tabla que ya lo tiene activo no es un
-- error. La politica va precedida de su `DROP POLICY IF EXISTS`, limitado a
-- ella y a su tabla. Sin `CASCADE`.
-- ============================================================================


-- ─── 1. public.profiles ─────────────────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;


-- ─── 2. public.patient_therapist ────────────────────────────────────────────

ALTER TABLE public.patient_therapist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Parties close their own relationship"
  ON public.patient_therapist;

CREATE POLICY "Parties close their own relationship"
  ON public.patient_therapist
  AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = patient_id
    OR auth.uid() = therapist_id
  )
  WITH CHECK (
    auth.uid() = patient_id
    OR auth.uid() = therapist_id
  );


-- ─── 3. public.therapy_sessions ─────────────────────────────────────────────

ALTER TABLE public.therapy_sessions ENABLE ROW LEVEL SECURITY;
