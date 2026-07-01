-- clinical_alerts ya existía en el esquema y PatientDashboard.tsx ya se suscribe por Realtime a sus
-- INSERTs (filtro patient_id=eq.<id>), pero la tabla tenía RLS DESACTIVADO y CERO políticas — el
-- filtro del cliente no es un límite de seguridad real. No se detectó explotación porque la tabla no
-- tenía filas reales todavía (sin flujo que escribiera en ella). La UI de PHQ-9 va a ser el primer
-- flujo real que inserta aquí (ítem 9 = riesgo de autolesión), así que:
--   1. Activar RLS sin una policy de SELECT para el propio paciente rompería la alerta de crisis que
--      ya está en producción (Supabase Realtime exige que la policy permita la fila para emitir el
--      evento). Se agrega esa policy primero para no regresionar la función existente.
--   2. Se agrega INSERT para que el paciente (o su terapeuta asignado) pueda generar la alerta.

ALTER TABLE clinical_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Patients can view their own alerts" ON clinical_alerts;
CREATE POLICY "Patients can view their own alerts" ON clinical_alerts
    FOR SELECT
    USING (auth.uid() = patient_id);

DROP POLICY IF EXISTS "Therapists can view alerts of assigned patients" ON clinical_alerts;
CREATE POLICY "Therapists can view alerts of assigned patients" ON clinical_alerts
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM patient_therapist
            WHERE patient_therapist.therapist_id = auth.uid()
            AND patient_therapist.patient_id = clinical_alerts.patient_id
        )
    );

DROP POLICY IF EXISTS "Admins can view all alerts" ON clinical_alerts;
CREATE POLICY "Admins can view all alerts" ON clinical_alerts
    FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
    );

DROP POLICY IF EXISTS "Patients can insert their own alerts" ON clinical_alerts;
CREATE POLICY "Patients can insert their own alerts" ON clinical_alerts
    FOR INSERT
    WITH CHECK (auth.uid() = patient_id);

DROP POLICY IF EXISTS "Therapists can insert alerts for assigned patients" ON clinical_alerts;
CREATE POLICY "Therapists can insert alerts for assigned patients" ON clinical_alerts
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM patient_therapist
            WHERE patient_therapist.therapist_id = auth.uid()
            AND patient_therapist.patient_id = clinical_alerts.patient_id
        )
    );
