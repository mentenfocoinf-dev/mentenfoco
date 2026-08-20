-- ============================================================================
-- Perfil profesional de EJEMPLO, para poder verificar el matching de punta a
-- punta.
--
-- Se rellena la cuenta de prueba que ya existe (`terapeuta@test.com`) en vez de
-- inventar un profesional: los datos de un terapeuta real —especialidades,
-- credenciales, disponibilidad— los declara esa persona, no un seed.
--
-- Esta fila se va con la cuenta de prueba cuando se limpien los `@test.com`
-- antes de producción (ON DELETE CASCADE desde profiles).
--
-- Idempotente: se puede ejecutar las veces que haga falta.
-- ============================================================================
INSERT INTO public.therapist_profiles (
  profile_id, professional_name, license_number, bio,
  specializations, languages, modalities, age_groups, availability,
  years_experience, verified, active
)
SELECT
  p.id,
  'Terapeuta de Prueba',
  'TP-000000',
  'Perfil de ejemplo para pruebas del sistema de matching. No corresponde a un profesional real.',
  ARRAY['ansiedad_panico', 'sueno_descanso']::public.theme_key[],
  ARRAY['Español'],
  ARRAY['virtual', 'presencial']::public.therapy_modality[],
  ARRAY['adultos']::public.age_group[],
  ARRAY['mananas', 'tardes']::public.availability_slot[],
  5,
  true,
  true
FROM public.profiles p
WHERE p.email = 'terapeuta@test.com'
ON CONFLICT (profile_id) DO UPDATE SET
  specializations = EXCLUDED.specializations,
  languages       = EXCLUDED.languages,
  modalities      = EXCLUDED.modalities,
  age_groups      = EXCLUDED.age_groups,
  availability    = EXCLUDED.availability,
  verified        = EXCLUDED.verified,
  active          = EXCLUDED.active;

SELECT profile_id, professional_name, specializations, languages, modalities,
       availability, accepts_online, accepts_in_person, verified, active
FROM public.therapist_profiles;
