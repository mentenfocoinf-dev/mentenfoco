-- ============================================================================
-- Diferenciacion de documentos clinicos: valoracion / informe / evolucion.
--
-- Hasta ahora clinical_notes guardaba todo con la misma forma (SOAP generico),
-- lo que impedia distinguir una evaluacion inicial de una nota de seguimiento o
-- de un documento formal para entregar a terceros.
--
-- De paso cierra dos gaps de terapeuta ya diagnosticados: el plan de tratamiento
-- estructurado (columna treatment_plan) y el informe formal exportable
-- (document_type = 'informe').
-- ============================================================================

ALTER TABLE clinical_notes
  ADD COLUMN IF NOT EXISTS document_type text NOT NULL DEFAULT 'evolucion',
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES therapy_sessions(id),
  ADD COLUMN IF NOT EXISTS treatment_plan jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.clinical_notes'::regclass
      AND conname = 'clinical_notes_document_type_check'
  ) THEN
    ALTER TABLE clinical_notes
      ADD CONSTRAINT clinical_notes_document_type_check
      CHECK (document_type IN ('valoracion', 'informe', 'evolucion'));
  END IF;
END $$;

COMMENT ON COLUMN clinical_notes.document_type IS
  'valoracion: evaluacion inicial completa. evolucion: nota breve de seguimiento por sesion. informe: documento formal a demanda, no atado a una sesion.';
COMMENT ON COLUMN clinical_notes.session_id IS
  'Sesion de therapy_sessions a la que corresponde esta nota, si aplica (evoluciones normalmente si, informes normalmente no).';
COMMENT ON COLUMN clinical_notes.treatment_plan IS
  'Solo se usa en document_type=valoracion. Forma: {objetivos: text[], modalidad: text, frecuencia_sugerida: text, pronostico: text}.';

-- La ficha lista los documentos de un paciente por fecha descendente.
CREATE INDEX IF NOT EXISTS clinical_notes_patient_created_idx
  ON clinical_notes (patient_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- SOBRE EL BACKFILL DE LAS 20 NOTAS YA SEMBRADAS (seed del 22-jul)
--
-- La spec sugeria reclasificar por UPDATE la primera nota de cada paciente como
-- 'valoracion'. NO se hace, y no por comodidad: esas 20 notas estan firmadas y
-- el trigger tr_check_clinical_note_immutability rechaza cualquier UPDATE sobre
-- una nota firmada. Desactivarlo para editar historia clinica firmada es
-- justamente lo que ese control existe para impedir.
--
-- La alternativa aplicada es ademas mas correcta clinicamente: las 5 notas
-- sembradas por paciente SON notas de seguimiento (texto SOAP breve, sin plan de
-- tratamiento), asi que 'evolucion' -el DEFAULT- es su tipo real, no un valor
-- "sin sentido". Lo que faltaba era la valoracion inicial, y esa se INSERTA
-- nueva mas abajo, con la forma que le corresponde.
--
-- session_id queda NULL en las notas antiguas por el mismo motivo. La columna es
-- nullable y esta documentada como "si aplica"; las notas nuevas si lo llevan.
-- ---------------------------------------------------------------------------

-- Valoracion inicial por paciente, fechada un dia antes de su primera sesion.
-- Se inserta solo si ese paciente no tiene ya una valoracion, para que correr
-- esta migracion dos veces no duplique.
INSERT INTO clinical_notes (
  patient_id, therapist_id, document_type, soap_data, treatment_plan,
  is_signed, signed_at, created_at
)
SELECT
  pt.patient_id,
  pt.therapist_id,
  'valoracion',
  jsonb_build_object(
    'complaints', jsonb_build_array(),
    'diagnostic', COALESCE(
      (SELECT n.soap_data ->> 'diagnostic'
         FROM clinical_notes n
        WHERE n.patient_id = pt.patient_id
          AND COALESCE(n.soap_data ->> 'diagnostic', '') <> ''
        ORDER BY n.created_at ASC
        LIMIT 1),
      ''),
    'mental_exam', jsonb_build_object(
      'Apariencia', 'Adecuada',
      'Actitud', 'Colaboradora',
      'Orientación', 'Orientado (Global)',
      'Afecto', 'Ansioso'
    ),
    's', COALESCE(
      (SELECT a.data ->> 'motivo_consulta' FROM patient_anamnesis a
        WHERE a.patient_id = pt.patient_id LIMIT 1),
      'Motivo de consulta registrado en la anamnesis.'),
    'o', 'Paciente colaborador durante la entrevista inicial. Discurso coherente y contacto visual adecuado.',
    'a', 'Evaluacion inicial. Se establece linea base con PHQ-9 y GAD-7 aplicados en la primera sesion.',
    'p', 'Iniciar proceso terapeutico segun el plan de tratamiento definido.'
  ),
  jsonb_build_object(
    'objetivos', jsonb_build_array(
      'Reducir la sintomatologia reportada en el motivo de consulta.',
      'Desarrollar estrategias de afrontamiento aplicables al dia a dia.',
      'Fortalecer la red de apoyo identificada en la anamnesis.'
    ),
    'modalidad', 'Terapia cognitivo-conductual individual',
    'frecuencia_sugerida', 'Semanal',
    'pronostico', 'Favorable con adherencia al proceso.'
  ),
  true,
  primera.fecha - interval '1 day',
  primera.fecha - interval '1 day'
FROM patient_therapist pt
JOIN LATERAL (
  SELECT min(s.scheduled_at) AS fecha
    FROM therapy_sessions s
   WHERE s.patient_id = pt.patient_id
) primera ON primera.fecha IS NOT NULL
WHERE NOT EXISTS (
  SELECT 1 FROM clinical_notes n
   WHERE n.patient_id = pt.patient_id
     AND n.document_type = 'valoracion'
);
