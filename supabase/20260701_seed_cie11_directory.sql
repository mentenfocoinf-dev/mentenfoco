-- Carga del catálogo CIE-11, Capítulo 06 (Trastornos mentales, del comportamiento o del
-- neurodesarrollo), en cie11_directory. Fuente: investigacion-clinica-cie11-dsm5/01_CIE11_Codigos_Salud_Mental.md
-- (revisión CIE-11 v2026-01, verificada cruzando el documento oficial de la OMS y findacode.com/icd-11).
--
-- cie11_directory ya existía en producción sin migración versionada (ver hallazgo de esquema en
-- CONTEXTO_HANDOFF_2026-07-01.md). Columnas reales confirmadas en vivo via Supabase client:
-- id (uuid pk), code (text), description (text), category (text). Este archivo crea la tabla si no
-- existiera (para entornos nuevos) y agrega es_calificador para los códigos "calificador transversal"
-- (6A25, 6A80, 6D86) que no son diagnósticos independientes.
--
-- Nota sobre el bloque 12 (sustancias/adicciones): el archivo 01 lista las sustancias en prosa sin
-- código exacto por sustancia (fue uno de los 9 bloques "completados con conocimiento clínico estable",
-- no verificado en vivo subcódigo por subcódigo). Los códigos 6C40-6C4F/6C4Z de abajo siguen la
-- estructura oficial estable de la CIE-11 para ese bloque. El resto de las filas sigue el archivo 01
-- prácticamente literal (nombres cortos de categoría, no los criterios diagnósticos con derechos de
-- autor de la OMS).

CREATE TABLE IF NOT EXISTS cie11_directory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL
);

ALTER TABLE cie11_directory ADD COLUMN IF NOT EXISTS es_calificador BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'cie11_directory_code_key'
    ) THEN
        ALTER TABLE cie11_directory ADD CONSTRAINT cie11_directory_code_key UNIQUE (code);
    END IF;
END $$;

ALTER TABLE cie11_directory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura de cie11_directory a usuarios autenticados" ON cie11_directory;
CREATE POLICY "Permitir lectura de cie11_directory a usuarios autenticados" ON cie11_directory
    FOR SELECT TO authenticated USING (true);

INSERT INTO cie11_directory (code, description, category, es_calificador) VALUES
-- Bloque 1 — Trastornos del neurodesarrollo (6A00-6A0Z)
('6A00', 'Trastornos del desarrollo intelectual', 'Trastornos del neurodesarrollo', false),
('6A01', 'Trastornos del desarrollo del habla o del lenguaje', 'Trastornos del neurodesarrollo', false),
('6A02', 'Trastorno del espectro autista', 'Trastornos del neurodesarrollo', false),
('6A03', 'Trastorno del desarrollo de la coordinación', 'Trastornos del neurodesarrollo', false),
('6A04', 'Trastorno por déficit de atención con hiperactividad', 'Trastornos del neurodesarrollo', false),
('6A05', 'Trastorno de movimientos estereotipados', 'Trastornos del neurodesarrollo', false),
('6A06', 'Trastorno específico del aprendizaje', 'Trastornos del neurodesarrollo', false),
('6A0Y', 'Otro trastorno del neurodesarrollo, especificado', 'Trastornos del neurodesarrollo', false),
('6A0Z', 'Trastorno del neurodesarrollo, sin especificación', 'Trastornos del neurodesarrollo', false),

-- Bloque 2 — Esquizofrenia y otros trastornos psicóticos primarios (6A20-6A2Z)
('6A20', 'Esquizofrenia', 'Esquizofrenia y otros trastornos psicóticos primarios', false),
('6A21', 'Trastorno esquizoafectivo', 'Esquizofrenia y otros trastornos psicóticos primarios', false),
('6A22', 'Trastorno esquizotípico', 'Esquizofrenia y otros trastornos psicóticos primarios', false),
('6A23', 'Trastorno psicótico agudo y transitorio', 'Esquizofrenia y otros trastornos psicóticos primarios', false),
('6A24', 'Trastorno delirante', 'Esquizofrenia y otros trastornos psicóticos primarios', false),
('6A25', 'Manifestaciones sintomáticas de los trastornos psicóticos primarios', 'Esquizofrenia y otros trastornos psicóticos primarios', true),
('6A2Y', 'Otro trastorno psicótico primario, especificado', 'Esquizofrenia y otros trastornos psicóticos primarios', false),
('6A2Z', 'Trastorno psicótico primario, sin especificación', 'Esquizofrenia y otros trastornos psicóticos primarios', false),

-- Bloque 3 — Catatonía (6A40-6A4Z)
('6A40', 'Catatonía asociada a otro trastorno mental', 'Catatonía', false),
('6A41', 'Catatonía inducida por sustancias o medicamentos', 'Catatonía', false),
('6A4Z', 'Catatonía, sin especificación', 'Catatonía', false),

-- Bloque 4 — Trastornos del estado de ánimo (6A60-6A8Z)
('6A60', 'Trastorno bipolar tipo I', 'Trastornos del estado de ánimo', false),
('6A61', 'Trastorno bipolar tipo II', 'Trastornos del estado de ánimo', false),
('6A62', 'Trastorno ciclotímico', 'Trastornos del estado de ánimo', false),
('6A6Y', 'Otro trastorno bipolar o relacionado, especificado', 'Trastornos del estado de ánimo', false),
('6A6Z', 'Trastorno bipolar o relacionado, sin especificación', 'Trastornos del estado de ánimo', false),
('6A70', 'Trastorno depresivo, episodio único', 'Trastornos del estado de ánimo', false),
('6A71', 'Trastorno depresivo recurrente', 'Trastornos del estado de ánimo', false),
('6A72', 'Trastorno distímico', 'Trastornos del estado de ánimo', false),
('6A73', 'Trastorno mixto de ansiedad y depresión', 'Trastornos del estado de ánimo', false),
('6A7Y', 'Otro trastorno depresivo, especificado', 'Trastornos del estado de ánimo', false),
('6A7Z', 'Trastorno depresivo, sin especificación', 'Trastornos del estado de ánimo', false),
('6A80', 'Presentaciones sintomáticas y de curso de los episodios anímicos', 'Trastornos del estado de ánimo', true),
('6A8Y', 'Otro trastorno del estado de ánimo, especificado', 'Trastornos del estado de ánimo', false),
('6A8Z', 'Trastorno del estado de ánimo, sin especificación', 'Trastornos del estado de ánimo', false),

-- Bloque 5 — Trastornos de ansiedad o relacionados con el miedo (6B00-6B0Z)
('6B00', 'Trastorno de ansiedad generalizada', 'Trastornos de ansiedad', false),
('6B01', 'Trastorno de pánico', 'Trastornos de ansiedad', false),
('6B02', 'Agorafobia', 'Trastornos de ansiedad', false),
('6B03', 'Fobia específica', 'Trastornos de ansiedad', false),
('6B04', 'Trastorno de ansiedad social', 'Trastornos de ansiedad', false),
('6B05', 'Trastorno de ansiedad por separación', 'Trastornos de ansiedad', false),
('6B06', 'Mutismo selectivo', 'Trastornos de ansiedad', false),
('6B0Y', 'Otro trastorno de ansiedad, especificado', 'Trastornos de ansiedad', false),
('6B0Z', 'Trastorno de ansiedad, sin especificación', 'Trastornos de ansiedad', false),

-- Bloque 6 — Trastorno obsesivo-compulsivo y relacionados (6B20-6B2Z)
('6B20', 'Trastorno obsesivo-compulsivo', 'Trastornos obsesivo-compulsivos', false),
('6B21', 'Trastorno dismórfico corporal', 'Trastornos obsesivo-compulsivos', false),
('6B22', 'Trastorno de referencia olfativa', 'Trastornos obsesivo-compulsivos', false),
('6B23', 'Hipocondría (trastorno de ansiedad por enfermedad)', 'Trastornos obsesivo-compulsivos', false),
('6B24', 'Trastorno de acumulación', 'Trastornos obsesivo-compulsivos', false),
('6B25', 'Trastorno de comportamiento repetitivo centrado en el cuerpo', 'Trastornos obsesivo-compulsivos', false),
('6B2Y', 'Otro trastorno obsesivo-compulsivo o relacionado, especificado', 'Trastornos obsesivo-compulsivos', false),
('6B2Z', 'Trastorno obsesivo-compulsivo o relacionado, sin especificación', 'Trastornos obsesivo-compulsivos', false),

-- Bloque 7 — Trastornos específicamente asociados con el estrés (6B40-6B4Z)
('6B40', 'Trastorno de estrés postraumático', 'Trastornos relacionados con el estrés', false),
('6B41', 'Trastorno de estrés postraumático complejo', 'Trastornos relacionados con el estrés', false),
('6B42', 'Trastorno de duelo prolongado', 'Trastornos relacionados con el estrés', false),
('6B43', 'Trastorno de adaptación', 'Trastornos relacionados con el estrés', false),
('6B44', 'Trastorno de apego reactivo', 'Trastornos relacionados con el estrés', false),
('6B45', 'Trastorno de relación social desinhibida', 'Trastornos relacionados con el estrés', false),
('6B4Y', 'Otro trastorno relacionado con el estrés, especificado', 'Trastornos relacionados con el estrés', false),
('6B4Z', 'Trastorno relacionado con el estrés, sin especificación', 'Trastornos relacionados con el estrés', false),

-- Bloque 8 — Trastornos disociativos (6B60-6B6Z)
('6B60', 'Trastorno disociativo neurológico', 'Trastornos disociativos', false),
('6B61', 'Amnesia disociativa', 'Trastornos disociativos', false),
('6B62', 'Trastorno de trance', 'Trastornos disociativos', false),
('6B63', 'Trastorno de trance de posesión', 'Trastornos disociativos', false),
('6B64', 'Trastorno de identidad disociativo', 'Trastornos disociativos', false),
('6B65', 'Trastorno de identidad disociativo parcial', 'Trastornos disociativos', false),
('6B66', 'Trastorno de despersonalización-desrealización', 'Trastornos disociativos', false),
('6B6Y', 'Otro trastorno disociativo, especificado', 'Trastornos disociativos', false),
('6B6Z', 'Trastorno disociativo, sin especificación', 'Trastornos disociativos', false),

-- Bloque 9 — Trastornos de la conducta alimentaria y de la ingesta de alimentos (6B80-6B8Z)
('6B80', 'Anorexia nerviosa', 'Trastornos de la conducta alimentaria', false),
('6B81', 'Bulimia nerviosa', 'Trastornos de la conducta alimentaria', false),
('6B82', 'Trastorno de atracones', 'Trastornos de la conducta alimentaria', false),
('6B83', 'Trastorno de evitación/restricción de la ingesta de alimentos', 'Trastornos de la conducta alimentaria', false),
('6B84', 'Pica', 'Trastornos de la conducta alimentaria', false),
('6B85', 'Trastorno de rumiación-regurgitación', 'Trastornos de la conducta alimentaria', false),
('6B8Y', 'Otro trastorno de la conducta alimentaria, especificado', 'Trastornos de la conducta alimentaria', false),
('6B8Z', 'Trastorno de la conducta alimentaria, sin especificación', 'Trastornos de la conducta alimentaria', false),

-- Bloque 10 — Trastornos de la eliminación (6C00-6C0Z)
('6C00', 'Enuresis', 'Trastornos de la eliminación', false),
('6C01', 'Encopresis', 'Trastornos de la eliminación', false),
('6C0Y', 'Otro trastorno de la eliminación, especificado', 'Trastornos de la eliminación', false),
('6C0Z', 'Trastorno de la eliminación, sin especificación', 'Trastornos de la eliminación', false),

-- Bloque 11 — Trastornos del malestar corporal o de la experiencia corporal (6C20-6C2Z)
('6C20', 'Trastorno de malestar corporal', 'Trastornos del malestar corporal', false),
('6C21', 'Trastorno de disforia de la integridad corporal', 'Trastornos del malestar corporal', false),
('6C2Y', 'Otro trastorno del malestar corporal, especificado', 'Trastornos del malestar corporal', false),
('6C2Z', 'Trastorno del malestar corporal, sin especificación', 'Trastornos del malestar corporal', false),

-- Bloque 12 — Trastornos por consumo de sustancias o comportamientos adictivos (6C40-6C5Z)
-- Subcódigos de sustancia (6C40-6C4F, 6C4Z) completados con la estructura oficial estable de la CIE-11,
-- ya que el archivo 01 solo listó las sustancias en prosa sin código exacto por sustancia.
('6C40', 'Trastornos por consumo de alcohol', 'Trastornos por consumo de sustancias y adicciones comportamentales', false),
('6C41', 'Trastornos por consumo de cannabis', 'Trastornos por consumo de sustancias y adicciones comportamentales', false),
('6C42', 'Trastornos por consumo de cannabinoides sintéticos', 'Trastornos por consumo de sustancias y adicciones comportamentales', false),
('6C43', 'Trastornos por consumo de opioides', 'Trastornos por consumo de sustancias y adicciones comportamentales', false),
('6C44', 'Trastornos por consumo de sedantes, hipnóticos o ansiolíticos', 'Trastornos por consumo de sustancias y adicciones comportamentales', false),
('6C45', 'Trastornos por consumo de cocaína', 'Trastornos por consumo de sustancias y adicciones comportamentales', false),
('6C46', 'Trastornos por consumo de estimulantes (anfetaminas, metanfetamina o metcatinona)', 'Trastornos por consumo de sustancias y adicciones comportamentales', false),
('6C47', 'Trastornos por consumo de catinonas sintéticas', 'Trastornos por consumo de sustancias y adicciones comportamentales', false),
('6C48', 'Trastornos por consumo de cafeína', 'Trastornos por consumo de sustancias y adicciones comportamentales', false),
('6C49', 'Trastornos por consumo de alucinógenos', 'Trastornos por consumo de sustancias y adicciones comportamentales', false),
('6C4A', 'Trastornos por consumo de nicotina', 'Trastornos por consumo de sustancias y adicciones comportamentales', false),
('6C4B', 'Trastornos por consumo de disolventes volátiles', 'Trastornos por consumo de sustancias y adicciones comportamentales', false),
('6C4C', 'Trastornos por consumo de MDMA o drogas relacionadas', 'Trastornos por consumo de sustancias y adicciones comportamentales', false),
('6C4D', 'Trastornos por consumo de drogas disociativas (ketamina, PCP)', 'Trastornos por consumo de sustancias y adicciones comportamentales', false),
('6C4E', 'Trastornos por consumo de otras sustancias psicoactivas especificadas', 'Trastornos por consumo de sustancias y adicciones comportamentales', false),
('6C4F', 'Trastornos por consumo de múltiples sustancias psicoactivas especificadas', 'Trastornos por consumo de sustancias y adicciones comportamentales', false),
('6C4Z', 'Trastornos por consumo de sustancia psicoactiva desconocida o no especificada', 'Trastornos por consumo de sustancias y adicciones comportamentales', false),
('6C50', 'Trastorno por juego', 'Trastornos por consumo de sustancias y adicciones comportamentales', false),
('6C51', 'Trastorno por videojuegos', 'Trastornos por consumo de sustancias y adicciones comportamentales', false),
('6C5Y', 'Otro trastorno por comportamientos adictivos, especificado', 'Trastornos por consumo de sustancias y adicciones comportamentales', false),
('6C5Z', 'Trastorno por comportamientos adictivos, sin especificación', 'Trastornos por consumo de sustancias y adicciones comportamentales', false),

-- Bloque 13 — Trastornos del control de los impulsos (6C70-6C7Z)
('6C70', 'Piromanía', 'Trastornos del control de los impulsos', false),
('6C71', 'Cleptomanía', 'Trastornos del control de los impulsos', false),
('6C72', 'Trastorno explosivo intermitente', 'Trastornos del control de los impulsos', false),
('6C73', 'Trastorno de comportamiento sexual compulsivo', 'Trastornos del control de los impulsos', false),
('6C7Y', 'Otro trastorno del control de los impulsos, especificado', 'Trastornos del control de los impulsos', false),
('6C7Z', 'Trastorno del control de los impulsos, sin especificación', 'Trastornos del control de los impulsos', false),

-- Bloque 14 — Trastornos disruptivos del comportamiento o disociales (6C90-6C9Z)
('6C90', 'Trastorno negativista desafiante', 'Trastornos disruptivos del comportamiento o disociales', false),
('6C91', 'Trastorno disocial-conductual', 'Trastornos disruptivos del comportamiento o disociales', false),
('6C9Y', 'Otro trastorno disruptivo o disocial, especificado', 'Trastornos disruptivos del comportamiento o disociales', false),
('6C9Z', 'Trastorno disruptivo o disocial, sin especificación', 'Trastornos disruptivos del comportamiento o disociales', false),

-- Bloque 15 — Trastornos de la personalidad y rasgos relacionados (6D10-6D11.5)
-- Solo se cargan los dos códigos base de 4 caracteres; el modelo dimensional usa calificadores
-- (severidad, rasgos, patrón límite) que no son categorías independientes.
('6D10', 'Trastorno de la personalidad', 'Trastornos de la personalidad', false),
('6D11', 'Rasgos o patrones de personalidad prominentes', 'Trastornos de la personalidad', false),

-- Bloque 16 — Trastornos parafílicos (6D30-6D3Z)
('6D30', 'Trastorno exhibicionista', 'Trastornos parafílicos', false),
('6D31', 'Trastorno voyeurista', 'Trastornos parafílicos', false),
('6D32', 'Trastorno pedófilo', 'Trastornos parafílicos', false),
('6D33', 'Trastorno de sadismo sexual coercitivo', 'Trastornos parafílicos', false),
('6D34', 'Trastorno froteurista', 'Trastornos parafílicos', false),
('6D35', 'Otro trastorno parafílico que involucra a personas sin consentimiento', 'Trastornos parafílicos', false),
('6D36', 'Trastorno parafílico que involucra comportamiento solitario o con consentimiento', 'Trastornos parafílicos', false),
('6D3Y', 'Otro trastorno parafílico, especificado', 'Trastornos parafílicos', false),
('6D3Z', 'Trastorno parafílico, sin especificación', 'Trastornos parafílicos', false),

-- Bloque 17 — Trastornos facticios (6D50-6D5Z)
('6D50', 'Trastorno facticio autoinducido', 'Trastornos facticios', false),
('6D51', 'Trastorno facticio impuesto a otro', 'Trastornos facticios', false),
('6D5Y', 'Otro trastorno facticio, especificado', 'Trastornos facticios', false),
('6D5Z', 'Trastorno facticio, sin especificación', 'Trastornos facticios', false),

-- Bloque 18 — Trastornos neurocognitivos (6D70-6E0Z) — bloque directamente relevante a deterioro cognitivo
('6D70', 'Delirium', 'Trastornos neurocognitivos', false),
('6D71', 'Trastorno neurocognitivo leve', 'Trastornos neurocognitivos', false),
('6D72', 'Trastorno amnésico', 'Trastornos neurocognitivos', false),
('6D80', 'Demencia debida a enfermedad de Alzheimer', 'Trastornos neurocognitivos', false),
('6D81', 'Demencia debida a enfermedad cerebrovascular (demencia vascular)', 'Trastornos neurocognitivos', false),
('6D82', 'Demencia debida a enfermedad por cuerpos de Lewy', 'Trastornos neurocognitivos', false),
('6D83', 'Demencia frontotemporal', 'Trastornos neurocognitivos', false),
('6D84', 'Demencia debida a sustancias psicoactivas, incluidos medicamentos', 'Trastornos neurocognitivos', false),
('6D85', 'Demencia debida a otras enfermedades clasificadas en otro lugar', 'Trastornos neurocognitivos', false),
('6D86', 'Alteraciones conductuales o psicológicas en la demencia', 'Trastornos neurocognitivos', true),
('6D8Y', 'Demencia, otra causa especificada', 'Trastornos neurocognitivos', false),
('6D8Z', 'Demencia, causa desconocida o sin especificación', 'Trastornos neurocognitivos', false),
('6E0Y', 'Otro trastorno neurocognitivo, especificado', 'Trastornos neurocognitivos', false),
('6E0Z', 'Trastorno neurocognitivo, sin especificación', 'Trastornos neurocognitivos', false),

-- Bloque 19 — Trastornos asociados con el embarazo, parto o puerperio (6E20-6E2Z)
('6E20', 'Trastorno mental asociado al embarazo, parto o puerperio, sin síntomas psicóticos', 'Trastornos asociados con el embarazo, parto o puerperio', false),
('6E21', 'Trastorno mental asociado al embarazo, parto o puerperio, con síntomas psicóticos', 'Trastornos asociados con el embarazo, parto o puerperio', false),
('6E2Y', 'Otro trastorno mental asociado al embarazo, parto o puerperio, especificado', 'Trastornos asociados con el embarazo, parto o puerperio', false),
('6E2Z', 'Trastorno mental asociado al embarazo, parto o puerperio, sin especificación', 'Trastornos asociados con el embarazo, parto o puerperio', false),

-- Bloque 20 — Factores psicológicos o del comportamiento que afectan trastornos clasificados en otro lugar
('6E40', 'Factores psicológicos o del comportamiento que afectan trastornos o enfermedades clasificados en otro lugar', 'Factores psicológicos que afectan otros trastornos', false),

-- Bloque 21 — Síndromes mentales o del comportamiento secundarios (6E60-6E6Z)
('6E60', 'Síndrome del neurodesarrollo secundario', 'Síndromes mentales secundarios a otras enfermedades', false),
('6E61', 'Síndrome psicótico secundario', 'Síndromes mentales secundarios a otras enfermedades', false),
('6E62', 'Síndrome del estado de ánimo secundario', 'Síndromes mentales secundarios a otras enfermedades', false),
('6E63', 'Síndrome de ansiedad secundario', 'Síndromes mentales secundarios a otras enfermedades', false),
('6E64', 'Síndrome obsesivo-compulsivo o relacionado, secundario', 'Síndromes mentales secundarios a otras enfermedades', false),
('6E65', 'Síndrome disociativo secundario', 'Síndromes mentales secundarios a otras enfermedades', false),
('6E66', 'Síndrome de control de impulsos secundario', 'Síndromes mentales secundarios a otras enfermedades', false),
('6E67', 'Síndrome neurocognitivo secundario', 'Síndromes mentales secundarios a otras enfermedades', false),
('6E68', 'Cambio de personalidad secundario', 'Síndromes mentales secundarios a otras enfermedades', false),
('6E69', 'Síndrome catatónico secundario', 'Síndromes mentales secundarios a otras enfermedades', false),
('6E6Y', 'Otro síndrome mental o del comportamiento secundario, especificado', 'Síndromes mentales secundarios a otras enfermedades', false),
('6E6Z', 'Síndrome mental o del comportamiento secundario, sin especificación', 'Síndromes mentales secundarios a otras enfermedades', false),

-- Cierre de capítulo
('6E8Y', 'Otro trastorno mental, del comportamiento o del neurodesarrollo, especificado', 'Otros trastornos mentales, del comportamiento o del neurodesarrollo', false),
('6E8Z', 'Trastorno mental, del comportamiento o del neurodesarrollo, sin especificación', 'Otros trastornos mentales, del comportamiento o del neurodesarrollo', false)

ON CONFLICT (code) DO UPDATE SET
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    es_calificador = EXCLUDED.es_calificador;
