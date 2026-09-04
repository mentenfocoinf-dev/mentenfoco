-- ============================================================================
-- Rehabilitación cognitiva — backend (catálogo de ejercicios + progreso).
--
-- Reutiliza el modelo de gating por plan de `content_items` (plan_rank +
-- get_my_plan_rank, ADR-001/ADR-011: el plan FILTRA, no bloquea) y añade un
-- escalón para el anónimo (`visible_anonimo`), de modo que el gradiente sea:
--   anónimo (pocos) < cuenta gratis (más) < base < pro (todos).
--
-- La adaptación por EDAD es personalización (filtro de consulta por age_band),
-- NO una frontera de seguridad → no va en RLS. La RLS impone tier + estado.
--
-- Minijuegos ORIGINALES (no se clona NeuronUp — ADR-007). `game_kind` mapea a un
-- componente React; `config` guarda los parámetros por dificultad.
--
-- T&C de la sección: se registra el consentimiento del apartado en
-- `profiles.cognitive_terms_accepted_at` (el anónimo lo maneja el front por
-- almacenamiento local). Los datos de un menor y su consentimiento parental
-- siguen siendo una decisión de producto/legal aparte (no se resuelve aquí).
--
-- Backup: supabase/backups/20260826_pre_cognitive_rehab.sql
-- Idempotente: enums guardados, tablas IF NOT EXISTS, políticas DROP+CREATE,
--   columnas ADD IF NOT EXISTS, seed ON CONFLICT.
-- ============================================================================

BEGIN;

-- Enums --------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='exercise_game_kind') THEN
    CREATE TYPE public.exercise_game_kind AS ENUM ('memory_pairs','stroop_color','sequence_recall');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='exercise_age_band') THEN
    CREATE TYPE public.exercise_age_band AS ENUM ('ninos','adolescentes','adultos','adultos_mayores');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='exercise_difficulty') THEN
    CREATE TYPE public.exercise_difficulty AS ENUM ('facil','medio','dificil');
  END IF;
END $$;

-- Catálogo de ejercicios ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cognitive_exercises (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text UNIQUE NOT NULL,
  title           text NOT NULL,
  description     text,
  instructions    text,                                   -- claras y precisas
  game_kind       public.exercise_game_kind NOT NULL,
  domains         text[] NOT NULL DEFAULT '{}',           -- dominios cognitivos (vocabulario propio)
  age_band        public.exercise_age_band NOT NULL DEFAULT 'adultos',
  min_plan        public.plan_type NOT NULL DEFAULT 'free',
  visible_anonimo boolean NOT NULL DEFAULT false,         -- escalón extra para el visitante sin cuenta
  config          jsonb NOT NULL DEFAULT '{}',            -- parámetros por dificultad
  status          public.content_status NOT NULL DEFAULT 'borrador',
  theme_key       public.theme_key,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Progreso por usuario -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_exercise_sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  exercise_id      uuid NOT NULL REFERENCES public.cognitive_exercises(id) ON DELETE CASCADE,
  difficulty       public.exercise_difficulty NOT NULL,
  score            integer,
  accuracy         numeric,                                -- 0..1 (para "en qué mejorar")
  duration_seconds integer,
  completed        boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_exercise_sessions_patient_idx
  ON public.user_exercise_sessions (patient_id, exercise_id, created_at DESC);

-- Perfil: edad (adaptación) + aceptación de T&C del apartado ----------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birthdate date;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cognitive_terms_accepted_at timestamptz;
-- El dueño puede leerlas/escribirlas (no son campos bloqueados por el trigger de
-- propiedad). GRANT por columna, como el resto de `profiles`.
GRANT SELECT (birthdate, cognitive_terms_accepted_at),
      UPDATE (birthdate, cognitive_terms_accepted_at)
  ON public.profiles TO authenticated;

-- RLS ----------------------------------------------------------------------
ALTER TABLE public.cognitive_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_exercise_sessions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.cognitive_exercises FROM anon;
GRANT SELECT ON public.cognitive_exercises TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.cognitive_exercises TO authenticated;  -- gestión admin (RLS acota)
REVOKE ALL ON public.user_exercise_sessions FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.user_exercise_sessions TO authenticated;

-- Lectura pública: publicado + dentro del tier; anónimo solo lo marcado.
-- Espeja `content_items` (plan_rank + get_my_plan_rank + excepción staff).
DROP POLICY IF EXISTS "Public reads published exercises within plan" ON public.cognitive_exercises;
CREATE POLICY "Public reads published exercises within plan" ON public.cognitive_exercises
  FOR SELECT TO anon, authenticated
  USING (
    status = 'publicado'::public.content_status
    AND (
      get_my_role() = ANY (ARRAY['admin','therapist']::user_role[])
      OR (
        plan_rank(min_plan) <= get_my_plan_rank()
        AND (auth.uid() IS NOT NULL OR visible_anonimo = true)
      )
    )
  );
DROP POLICY IF EXISTS "Admins manage exercises" ON public.cognitive_exercises;
CREATE POLICY "Admins manage exercises" ON public.cognitive_exercises FOR ALL TO authenticated
  USING (get_my_role() = 'admin'::user_role) WITH CHECK (get_my_role() = 'admin'::user_role);

-- Progreso: owner-only (espeja journal_entries/mood_entries).
DROP POLICY IF EXISTS "Patients insert their own sessions" ON public.user_exercise_sessions;
CREATE POLICY "Patients insert their own sessions" ON public.user_exercise_sessions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = patient_id);
DROP POLICY IF EXISTS "Patients read their own sessions" ON public.user_exercise_sessions;
CREATE POLICY "Patients read their own sessions" ON public.user_exercise_sessions
  FOR SELECT TO authenticated USING (auth.uid() = patient_id);
DROP POLICY IF EXISTS "Patients update their own sessions" ON public.user_exercise_sessions;
CREATE POLICY "Patients update their own sessions" ON public.user_exercise_sessions
  FOR UPDATE TO authenticated USING (auth.uid() = patient_id) WITH CHECK (auth.uid() = patient_id);

-- Seed de 3 ejercicios (publicados) que demuestran el gradiente de tier ------
INSERT INTO public.cognitive_exercises
  (slug, title, description, instructions, game_kind, domains, age_band, min_plan, visible_anonimo, config, status)
VALUES
  ('pares-de-memoria', 'Pares de memoria',
   'Encuentra las parejas de cartas iguales en el menor número de intentos.',
   'Al empezar verás todas las cartas unos segundos para memorizarlas; luego se tapan y debes emparejarlas. Voltea dos por turno: si coinciden se quedan descubiertas. Cada dificultad tiene 5 subniveles que suben poco a poco.',
   'memory_pairs', ARRAY['memoria_trabajo','atencion_selectiva'], 'adultos', 'free', true,
   '{"levels":{"facil":[{"pairs":2,"previewMs":3000},{"pairs":3,"previewMs":3000},{"pairs":4,"previewMs":2600},{"pairs":4,"previewMs":2200},{"pairs":5,"previewMs":2000}],"medio":[{"pairs":5,"previewMs":1800},{"pairs":6,"previewMs":1700},{"pairs":6,"previewMs":1500},{"pairs":7,"previewMs":1400},{"pairs":7,"previewMs":1200}],"dificil":[{"pairs":7,"previewMs":1100},{"pairs":8,"previewMs":1000},{"pairs":8,"previewMs":800},{"pairs":8,"previewMs":600},{"pairs":8,"previewMs":400}]}}'::jsonb, 'publicado'),
  ('stroop-de-colores', 'Stroop de colores',
   'Responde el COLOR de la tinta, no la palabra. Entrena tu atención y control.',
   'Verás el nombre de un color escrito con una tinta de otro color. Toca el color de la TINTA, ignorando lo que dice la palabra, antes de que acabe el tiempo. Cada dificultad tiene 5 subniveles que suben la velocidad y la cantidad.',
   'stroop_color', ARRAY['atencion_selectiva','inhibicion','velocidad_procesamiento'], 'adultos', 'free', false,
   '{"levels":{"facil":[{"trials":8,"ms":3000},{"trials":10,"ms":2600},{"trials":12,"ms":2300},{"trials":14,"ms":2000},{"trials":16,"ms":1800}],"medio":[{"trials":16,"ms":1700},{"trials":18,"ms":1600},{"trials":20,"ms":1400},{"trials":22,"ms":1300},{"trials":24,"ms":1200}],"dificil":[{"trials":24,"ms":1100},{"trials":26,"ms":1000},{"trials":28,"ms":900},{"trials":30,"ms":800},{"trials":32,"ms":700}]}}'::jsonb, 'publicado'),
  ('secuencia', 'Secuencia',
   'Repite la secuencia de luces que se va haciendo cada vez más larga.',
   'Observa el orden en que se iluminan las fichas y repítelo tocándolas en la misma secuencia. Cada acierto añade un paso más. Cada dificultad tiene 5 subniveles que empiezan con una secuencia más larga.',
   'sequence_recall', ARRAY['memoria_secuencial','atencion_sostenida'], 'adultos', 'esencial', false,
   '{"levels":{"facil":[{"start":2},{"start":3},{"start":3},{"start":4},{"start":4}],"medio":[{"start":4},{"start":5},{"start":5},{"start":6},{"start":6}],"dificil":[{"start":6},{"start":7},{"start":7},{"start":8},{"start":8}]}}'::jsonb, 'publicado')
ON CONFLICT (slug) DO UPDATE SET
  title=EXCLUDED.title, description=EXCLUDED.description, instructions=EXCLUDED.instructions,
  game_kind=EXCLUDED.game_kind, domains=EXCLUDED.domains, age_band=EXCLUDED.age_band,
  min_plan=EXCLUDED.min_plan, visible_anonimo=EXCLUDED.visible_anonimo, config=EXCLUDED.config,
  status=EXCLUDED.status, updated_at=now();

COMMIT;

-- ============================================================================
-- REGLA 1 — el catálogo demuestra el estado final
-- ============================================================================
SELECT
  (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('cognitive_exercises','user_exercise_sessions')) AS tablas_nuevas,
  (SELECT bool_and(relrowsecurity) FROM pg_class WHERE oid IN ('public.cognitive_exercises'::regclass,'public.user_exercise_sessions'::regclass)) AS rls_ambas,
  (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename IN ('cognitive_exercises','user_exercise_sessions')) AS politicas_nuevas,
  (SELECT count(*) FROM public.cognitive_exercises WHERE status='publicado') AS ejercicios_publicados,
  (SELECT has_table_privilege('anon','public.cognitive_exercises','SELECT')) AS anon_select_catalogo,
  (SELECT has_table_privilege('anon','public.user_exercise_sessions','SELECT')) AS anon_select_progreso,
  (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name IN ('birthdate','cognitive_terms_accepted_at')) AS cols_profiles,
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r') AS tablas_base,
  (SELECT count(*) FROM pg_policies WHERE schemaname='public') AS politicas_total,
  (SELECT count(*) FROM pg_type WHERE typtype='e' AND typnamespace='public'::regnamespace) AS enums;
