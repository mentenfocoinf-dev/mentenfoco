-- ============================================================================
-- user_preferences — el contexto que la persona DECLARA sobre sí misma.
--
-- Lo que el onboarding recoge son preferencias, no clínica. La diferencia no es
-- de matiz:
--
--   patient_anamnesis  entrevista clínica. Va detrás del consentimiento de
--                      Ley 1090, la lee un profesional y forma historia clínica.
--   user_preferences   qué te interesa, cómo prefieres que te acompañen y
--                      cuándo puedes. Lo declaras tú, para ti, y solo sirve
--                      para orientar lo que se te ofrece.
--
-- Meterlo en la anamnesis habría convertido una pregunta de preferencia en un
-- dato clínico; meterlo en `profiles` habría mezclado identidad con gustos.
-- Por eso tabla propia, 1:1, y `profile_id` como PK y FK a la vez.
--
-- ── Qué NO se guarda, y no es un olvido ─────────────────────────────────────
--
-- Ni severidad, ni diagnóstico, ni puntajes, ni "nivel" de nada. Aquí no hay
-- ninguna columna donde quepa una clasificación clínica, y es a propósito: el
-- onboarding orienta lo que se muestra, nunca decide qué le pasa a nadie
-- (ADR-004, ADR-007).
--
-- ── Vocabularios ────────────────────────────────────────────────────────────
--
-- `themes`, `modalities` y `availability` reutilizan los enums que ya existen
-- —los mismos que clasifican el catálogo y describen a los profesionales—. Ese
-- es justo el motivo de que sean enums compartidos: lo que la persona declara y
-- lo que el sistema sabe se comparan sin traducir nada.
--
-- Solo `goal` estrena vocabulario, porque no había ninguno que dijera "qué
-- buscas ahora". Tres valores y cerrado.
--
-- ── Seguridad, con RLS desactivado ──────────────────────────────────────────
--
-- Los temas que alguien elige son información sensible: saber que una persona
-- entró pidiendo duelo y trauma dice tanto como una respuesta de un test. Por
-- eso NO se concede SELECT a nadie. Se lee por función SECURITY DEFINER que
-- filtra por auth.uid(), igual que el recorrido del Journey. Escribir sí es
-- directo, con trigger de propiedad.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'onboarding_goal') THEN
    -- Qué busca la persona AHORA. No es un rasgo ni un estado: cambia, y se
    -- puede volver a elegir cuando quiera.
    CREATE TYPE public.onboarding_goal AS ENUM (
      'entender',            -- quiero entender qué me pasa
      'practicar',           -- quiero herramientas concretas
      'hablar_con_alguien'   -- quiero acompañamiento profesional
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.user_preferences (
  profile_id   uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Temas de interés declarados. Tope de 3: pedir más produce una lista que no
  -- prioriza nada, y el motor recomienda sobre un tema, no sobre quince.
  themes       public.theme_key[] NOT NULL DEFAULT '{}'
                 CHECK (array_length(themes, 1) IS NULL OR array_length(themes, 1) <= 3),
  goal         public.onboarding_goal,

  language     text,
  modalities   public.therapy_modality[]  NOT NULL DEFAULT '{}',
  availability public.availability_slot[] NOT NULL DEFAULT '{}',

  -- Cuándo terminó el flujo. NULL = empezado y no terminado, que es un estado
  -- válido: el onboarding no bloquea nada y se puede abandonar.
  completed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_preferences IS
  'Preferencias declaradas por la persona para orientar contenido y acompañamiento. NO es clínica: no admite severidad ni diagnóstico.';
COMMENT ON COLUMN public.user_preferences.themes IS
  'Mismo enum theme_key que el catálogo y que las especialidades del terapeuta.';

-- ── Solo el dueño edita lo suyo ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_user_preferences_ownership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  quien uuid := auth.uid();
  rol   text := coalesce(current_setting('request.jwt.claims', true)::json->>'role', '');
BEGIN
  IF rol = 'service_role' OR (quien IS NULL AND rol = '') THEN
    RETURN NEW;
  END IF;

  IF NEW.profile_id IS DISTINCT FROM quien THEN
    RAISE EXCEPTION 'USER_PREFERENCES_FORBIDDEN: solo puedes editar tus propias preferencias.';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_user_preferences_ownership ON public.user_preferences;
CREATE TRIGGER trg_user_preferences_ownership
  BEFORE INSERT OR UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.enforce_user_preferences_ownership();

-- ── Lectura: solo las propias ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_preferences()
RETURNS TABLE (
  themes       public.theme_key[],
  goal         public.onboarding_goal,
  language     text,
  modalities   public.therapy_modality[],
  availability public.availability_slot[],
  completed_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT p.themes, p.goal, p.language, p.modalities, p.availability, p.completed_at
  FROM user_preferences p
  WHERE auth.uid() IS NOT NULL AND p.profile_id = auth.uid()
$$;

COMMENT ON FUNCTION public.get_my_preferences() IS
  'Preferencias de quien llama. Filtra por auth.uid() internamente; sin sesión devuelve vacío.';

-- ── Permisos ────────────────────────────────────────────────────────────────
-- Sin SELECT: los temas que alguien elige no son un directorio público.
REVOKE ALL ON public.user_preferences FROM anon, authenticated;
GRANT INSERT, UPDATE ON public.user_preferences TO authenticated;

REVOKE ALL ON FUNCTION public.get_my_preferences() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_preferences() TO anon, authenticated;

-- ── Policies equivalentes, para cuando se active RLS ────────────────────────
-- ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
--
-- CREATE POLICY "cada quien ve y edita las suyas"
--   ON public.user_preferences FOR ALL
--   USING (profile_id = auth.uid())
--   WITH CHECK (profile_id = auth.uid());
