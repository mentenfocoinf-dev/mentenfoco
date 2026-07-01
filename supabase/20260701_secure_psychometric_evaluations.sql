-- psychometric_evaluations ya existía en el esquema (según auditoría previa) con 2 políticas de
-- SELECT ya escritas ("Patients can view their own evaluations", "Therapists can view evaluations of
-- assigned patients") pero RLS estaba DESACTIVADO a nivel de tabla, dejándolas sin efecto, y no existía
-- ninguna política de INSERT. Hasta ahora la tabla no tenía filas reales (0 rows verificado en vivo),
-- así que esto no era explotable en la práctica, pero la nueva UI de PHQ-9/GAD-7 va a empezar a
-- escribir datos clínicos reales aquí — activar RLS y agregar el INSERT que falta es requisito para
-- que la funcionalidad no exponga evaluaciones de un paciente a otro. No es uno de los 4 hallazgos de
-- seguridad documentados (password=email, Stripe test, RLS de guías premium, esquema sin migración);
-- es una corrección puntual necesaria para que este ítem del roadmap no nazca inseguro.

ALTER TABLE psychometric_evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Patients can insert their own evaluations" ON psychometric_evaluations;
CREATE POLICY "Patients can insert their own evaluations" ON psychometric_evaluations
    FOR INSERT
    WITH CHECK (auth.uid() = patient_id);

DROP POLICY IF EXISTS "Therapists can insert evaluations for assigned patients" ON psychometric_evaluations;
CREATE POLICY "Therapists can insert evaluations for assigned patients" ON psychometric_evaluations
    FOR INSERT
    WITH CHECK (
        auth.uid() = therapist_id
        AND EXISTS (
            SELECT 1 FROM patient_therapist
            WHERE patient_therapist.therapist_id = auth.uid()
            AND patient_therapist.patient_id = psychometric_evaluations.patient_id
        )
    );
