-- Anamnesis clínica real para /anamnesis (antes solo pedía nombre completo — hallazgo repetido en
-- ambas auditorías). Sigue el mismo patrón jsonb que clinical_notes.soap_data para no tener que
-- migrar columnas cada vez que cambie la estructura del formulario.
--
-- Forma esperada de `data` (documentada aquí, tipada en src/routes/anamnesis.tsx):
-- {
--   motivo_consulta: string,
--   antecedentes_medicos: { seleccionados: string[], otros: string },
--   medicacion_actual: { nombre: string, dosis: string, prescriptor: string }[],
--   antecedentes_psiquiatricos_personales: string,
--   antecedentes_psiquiatricos_familiares: string,
--   consumo_sustancias: {
--     alcohol_audit_c: { respuestas: number[3], puntaje: number },
--     tabaco: string,
--     otras_sustancias: string
--   },
--   autolesion: { tiene_antecedentes: boolean, detalle: string },
--   red_apoyo: string,
--   cribado_cognitivo: { aplica: boolean, cambios_memoria: boolean, familiar_noto_cambios: boolean,
--                         interfiere_actividades: boolean } | null
-- }

CREATE TABLE IF NOT EXISTS patient_anamnesis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Columna derivada para triage rápido del terapeuta sin parsear el jsonb (AUDIT-C, 0-12).
    audit_c_score INTEGER,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE patient_anamnesis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Patients manage their own anamnesis" ON patient_anamnesis;
CREATE POLICY "Patients manage their own anamnesis" ON patient_anamnesis
    FOR ALL
    USING (auth.uid() = patient_id)
    WITH CHECK (auth.uid() = patient_id);

DROP POLICY IF EXISTS "Therapists can view their patients anamnesis" ON patient_anamnesis;
CREATE POLICY "Therapists can view their patients anamnesis" ON patient_anamnesis
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM patient_therapist
            WHERE patient_therapist.therapist_id = auth.uid()
            AND patient_therapist.patient_id = patient_anamnesis.patient_id
        )
    );

DROP POLICY IF EXISTS "Admins can view all anamnesis" ON patient_anamnesis;
CREATE POLICY "Admins can view all anamnesis" ON patient_anamnesis
    FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
    );
