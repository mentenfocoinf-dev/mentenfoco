-- ============================================================================
-- Tests publicos sin login (Ola 2).
--
-- Capa SEPARADA de las evaluaciones internas del portal: aqui no hay paciente,
-- no hay seguimiento longitudinal y no hay historia clinica. Es la puerta de
-- entrada — alguien que no nos conoce responde un cribado y ve su resultado.
--
-- Dos tablas con perfiles de acceso opuestos, y por eso van separadas:
--   public_tests             definiciones. No hay dato de nadie -> lectura anon.
--   public_test_submissions  lo que respondio la gente -> se escribe abierto,
--                            se lee solo admin.
--
-- Nota de alcance: C-SSRS (riesgo suicida) NO se siembra aqui y no debe
-- sembrarse. Evaluar ideacion suicida en un flujo anonimo y sin contencion es un
-- riesgo clinico; ese instrumento se queda dentro del portal. Hay un trigger mas
-- abajo que lo impide por si alguien lo intenta desde un seed.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public_tests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text UNIQUE NOT NULL,
  nombre          text NOT NULL,
  instrumento     text NOT NULL,
  categoria       text NOT NULL,
  descripcion     text NOT NULL,
  tiempo_estimado text,
  -- [{ n, texto, opciones: [{ label, valor }] }]
  items           jsonb NOT NULL,
  -- [{ min, max, etiqueta, interpretacion, recomendacion }]
  bandas          jsonb NOT NULL,
  activo          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT public_tests_items_no_vacio_check
    CHECK (jsonb_typeof(items) = 'array' AND jsonb_array_length(items) > 0),
  CONSTRAINT public_tests_bandas_no_vacio_check
    CHECK (jsonb_typeof(bandas) = 'array' AND jsonb_array_length(bandas) > 0)
);

CREATE INDEX IF NOT EXISTS public_tests_activo_idx
  ON public_tests (activo, categoria);

CREATE TABLE IF NOT EXISTS public_test_submissions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_slug  text NOT NULL REFERENCES public_tests(slug) ON UPDATE CASCADE,
  score      integer,
  banda      text,
  -- Solo si la persona lo deja voluntariamente. El resultado se ve sin esto.
  email      text,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT public_test_submissions_email_check
    CHECK (email IS NULL OR email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

CREATE INDEX IF NOT EXISTS public_test_submissions_slug_idx
  ON public_test_submissions (test_slug, created_at DESC);

-- Leads: los envios que dejaron correo, que es lo que el admin va a mirar.
CREATE INDEX IF NOT EXISTS public_test_submissions_email_idx
  ON public_test_submissions (created_at DESC)
  WHERE email IS NOT NULL;

-- ── C-SSRS no se ofrece en abierto ───────────────────────────────────────────
--
-- Decision clinica, no de producto: un cribado de riesgo suicida respondido de
-- forma anonima deja a la persona sola con el resultado, sin nadie que pueda
-- contener. Va como trigger y no como comentario porque una regla que solo vive
-- en la documentacion se rompe el dia que alguien copie el seed de otro test.
CREATE OR REPLACE FUNCTION enforce_no_public_risk_instrument()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.instrumento ~* '(c[- ]?ssrs|columbia)' OR NEW.slug ~* '(cssrs|suicid)' THEN
    RAISE EXCEPTION 'PUBLIC_TEST_RISK_INSTRUMENT_FORBIDDEN: los instrumentos de riesgo suicida no se ofrecen sin sesion ni acompanamiento.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_no_public_risk_instrument ON public_tests;
CREATE TRIGGER trg_no_public_risk_instrument
  BEFORE INSERT OR UPDATE ON public_tests
  FOR EACH ROW EXECUTE FUNCTION enforce_no_public_risk_instrument();

-- ── Un envio es un hecho, no un registro editable ────────────────────────────
--
-- No hay motivo legitimo para reescribir un envio ya hecho, y si lo hubiera
-- (borrar un correo a peticion de su titular) es un DELETE, no un UPDATE
-- silencioso del puntaje. Con RLS apagado esto es lo unico que impide que la
-- anon key manipule la analitica de captacion.
CREATE OR REPLACE FUNCTION enforce_submission_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'PUBLIC_SUBMISSION_APPEND_ONLY: un envio de test no se modifica.';
END;
$$;

DROP TRIGGER IF EXISTS trg_submission_append_only ON public_test_submissions;
CREATE TRIGGER trg_submission_append_only
  BEFORE UPDATE ON public_test_submissions
  FOR EACH ROW EXECUTE FUNCTION enforce_submission_append_only();

-- ============================================================================
-- FASE DE SEGURIDAD (no aplicar todavia: RLS esta desactivado a proposito en
-- todo el proyecto; ver 00 Indice maestro / Decisiones tecnicas).
--
-- Estas dos tablas son el caso donde RLS mas se echa de menos: hoy la anon key
-- puede LEER public_test_submissions, que es justo lo que las policies de abajo
-- impiden. Mientras siga apagado, la app nunca consulta esa tabla desde el
-- cliente (solo inserta) y el listado de leads vive en el panel del admin.
--
-- ALTER TABLE public_tests ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public_test_submissions ENABLE ROW LEVEL SECURITY;
--
-- -- Definiciones: cualquiera las lee. Son el contenido publico del test.
-- CREATE POLICY public_tests_select_todos ON public_tests
--   FOR SELECT USING (activo = true);
--
-- -- Solo el admin las administra.
-- CREATE POLICY public_tests_admin_all ON public_tests
--   FOR ALL USING (
--     EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
--   );
--
-- -- Envios: cualquiera inserta el suyo (el test es anonimo por diseno)...
-- CREATE POLICY public_test_submissions_insert_todos ON public_test_submissions
--   FOR INSERT WITH CHECK (true);
--
-- -- ...pero solo el admin los lee: es dato de captacion, y un correo ajeno no
-- -- puede quedar expuesto a quien pase por la ruta publica.
-- CREATE POLICY public_test_submissions_select_admin ON public_test_submissions
--   FOR SELECT USING (
--     EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
--   );
--
-- -- Sin policy de UPDATE (ademas del trigger). El DELETE queda para atender una
-- -- solicitud de supresion del titular, que hace el admin.
-- CREATE POLICY public_test_submissions_delete_admin ON public_test_submissions
--   FOR DELETE USING (
--     EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
--   );
-- ============================================================================
