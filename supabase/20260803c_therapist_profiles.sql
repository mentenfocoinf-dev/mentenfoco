-- ============================================================================
-- therapist_profiles — el perfil profesional, separado de la identidad.
--
-- `profiles` sigue siendo QUIÉN ERES: nombre, correo, teléfono, plan, cédula,
-- consentimientos. Esta tabla es QUÉ ATIENDES. No se mezclan porque no cambian
-- juntas ni las lee la misma gente: la identidad es de la persona, el perfil
-- profesional es del directorio público y del matching.
--
-- 1:1 con profiles: `profile_id` es a la vez PK y FK. No hace falta un id
-- propio — un terapeuta tiene un perfil profesional o no tiene ninguno.
--
-- ── Vocabularios cerrados ───────────────────────────────────────────────────
--
-- `specializations` usa el MISMO enum theme_key que clasifica el catálogo. Es
-- deliberado y es la razón de que el diccionario editorial exista: sin un
-- vocabulario compartido, contenido y profesionales acabarían con dos
-- taxonomías y el matching sería comparación de texto libre.
--
-- Modalidad, franjas y poblaciones también son enums. Con texto libre,
-- "Virtual", "virtual" y "en línea" son tres modalidades distintas y ninguna
-- regla determinista sobrevive a eso.
--
-- ── Seguridad, con RLS desactivado ──────────────────────────────────────────
--
-- Las reglas de negocio van en TRIGGERS, no en policies: con RLS apagado una
-- policy no se ejecuta. Dos cosas que no pueden pasar y aquí no pasan:
--
--   · que alguien edite el perfil profesional de otra persona;
--   · que un terapeuta se marque a sí mismo como `verified`. La verificación
--     de credenciales la hace el admin, o no significa nada.
--
-- Las policies equivalentes quedan escritas y comentadas al final, para el día
-- en que se active RLS.
-- ============================================================================

-- ── Vocabularios ────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'therapy_modality') THEN
    CREATE TYPE public.therapy_modality AS ENUM ('virtual', 'presencial');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'age_group') THEN
    CREATE TYPE public.age_group AS ENUM ('ninos', 'adolescentes', 'adultos', 'adultos_mayores');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'availability_slot') THEN
    CREATE TYPE public.availability_slot AS ENUM ('mananas', 'tardes', 'noches', 'fines_de_semana');
  END IF;
END
$$;

-- ── La tabla ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.therapist_profiles (
  profile_id        uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- El nombre con el que ejerce, que no siempre es el nombre legal de profiles.
  professional_name text NOT NULL CHECK (length(trim(professional_name)) > 0),
  -- Tarjeta profesional. Es público por naturaleza: sirve para verificar.
  license_number    text,
  bio               text CHECK (bio IS NULL OR length(bio) <= 2000),

  specializations   public.theme_key[]        NOT NULL DEFAULT '{}',
  languages         text[]                    NOT NULL DEFAULT '{}',
  modalities        public.therapy_modality[] NOT NULL DEFAULT '{}',
  age_groups        public.age_group[]        NOT NULL DEFAULT '{}',
  availability      public.availability_slot[] NOT NULL DEFAULT '{}',

  -- Derivadas de `modalities`, no capturadas aparte. Guardar el mismo dato en
  -- dos sitios es garantizar que algún día discrepen: el directorio filtraría
  -- por una cosa y el matching puntuaría por otra.
  accepts_online    boolean GENERATED ALWAYS AS ('virtual'::public.therapy_modality = ANY (modalities)) STORED,
  accepts_in_person boolean GENERATED ALWAYS AS ('presencial'::public.therapy_modality = ANY (modalities)) STORED,

  years_experience  smallint CHECK (years_experience IS NULL OR (years_experience >= 0 AND years_experience <= 70)),

  -- Solo el admin lo cambia. Ver trigger.
  verified          boolean NOT NULL DEFAULT false,
  -- Baja sin borrar: un profesional que deja de atender sale del matching pero
  -- sus notas clínicas y sesiones siguen existiendo.
  active            boolean NOT NULL DEFAULT true,

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.therapist_profiles IS
  'Datos profesionales del terapeuta. La identidad vive en profiles y no se mezcla.';
COMMENT ON COLUMN public.therapist_profiles.specializations IS
  'Mismo enum theme_key que el catálogo: es lo que permite cruzar motivo de consulta y profesional.';
COMMENT ON COLUMN public.therapist_profiles.verified IS
  'Credenciales revisadas por el admin. Un terapeuta no puede ponérselo a sí mismo.';

-- El matching lista profesionales activos y verificados; el índice es para eso.
CREATE INDEX IF NOT EXISTS idx_therapist_profiles_directorio
  ON public.therapist_profiles (active, verified);
CREATE INDEX IF NOT EXISTS idx_therapist_profiles_specializations
  ON public.therapist_profiles USING gin (specializations);

-- ── Solo el dueño (o el admin) edita su perfil ──────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_therapist_profile_ownership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  quien uuid := auth.uid();
  rol   text := coalesce(current_setting('request.jwt.claims', true)::json->>'role', '');
  es_admin boolean;
BEGIN
  -- service_role y las migraciones (sin JWT) pasan: son el propio sistema.
  IF rol = 'service_role' OR (quien IS NULL AND rol = '') THEN
    RETURN NEW;
  END IF;

  SELECT p.role = 'admin' INTO es_admin FROM profiles p WHERE p.id = quien;
  es_admin := coalesce(es_admin, false);

  IF NOT es_admin AND NEW.profile_id IS DISTINCT FROM quien THEN
    RAISE EXCEPTION 'THERAPIST_PROFILE_FORBIDDEN: solo puedes editar tu propio perfil profesional.';
  END IF;

  -- `verified` es una afirmación sobre credenciales revisadas. Que se la pueda
  -- poner el propio interesado la vacía de significado.
  IF NOT es_admin THEN
    IF TG_OP = 'INSERT' AND NEW.verified THEN
      RAISE EXCEPTION 'THERAPIST_PROFILE_VERIFIED_ADMIN_ONLY: la verificación la hace el admin.';
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.verified IS DISTINCT FROM OLD.verified THEN
      RAISE EXCEPTION 'THERAPIST_PROFILE_VERIFIED_ADMIN_ONLY: la verificación la hace el admin.';
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_therapist_profile_ownership ON public.therapist_profiles;
CREATE TRIGGER trg_therapist_profile_ownership
  BEFORE INSERT OR UPDATE ON public.therapist_profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_therapist_profile_ownership();

-- ── Permisos ────────────────────────────────────────────────────────────────
-- Lectura pública: es un directorio de profesionales, no un dato de terceros.
-- Escritura solo para autenticados, y el trigger decide de quién.
REVOKE ALL ON public.therapist_profiles FROM anon, authenticated;
GRANT SELECT ON public.therapist_profiles TO anon, authenticated;
GRANT INSERT, UPDATE ON public.therapist_profiles TO authenticated;

-- ── Policies equivalentes, para cuando se active RLS ────────────────────────
-- ALTER TABLE public.therapist_profiles ENABLE ROW LEVEL SECURITY;
--
-- CREATE POLICY "perfil profesional visible para todos"
--   ON public.therapist_profiles FOR SELECT USING (true);
--
-- CREATE POLICY "cada terapeuta edita el suyo"
--   ON public.therapist_profiles FOR ALL
--   USING (profile_id = auth.uid())
--   WITH CHECK (profile_id = auth.uid());
--
-- CREATE POLICY "el admin edita cualquiera"
--   ON public.therapist_profiles FOR ALL
--   USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
