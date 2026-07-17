-- Agenda de sesiones terapéuticas (paciente ↔ terapeuta). Hallazgo confirmado en la auditoría del
-- 2026-07-16: no existía ninguna tabla para sesiones programadas — el dashboard del paciente no
-- puede mostrar "próximas sesiones" y el del terapeuta no tiene forma de agendar. Se diseña completa
-- desde el inicio (no MVP mínimo) por decisión explícita del usuario, incluyendo enlace de
-- videollamada y estado de recordatorio, para no tener que migrar columnas de nuevo pronto.
--
-- Sigue los mismos patrones de RLS ya usados en clinical_alerts y patient_anamnesis:
-- paciente ve/gestiona lo suyo, terapeuta ve/gestiona lo de sus pacientes asignados (vía
-- patient_therapist), admin ve todo.
--
-- IMPORTANTE (regla "backend antes que frontend"): esta migración debe aplicarse y probarse contra
-- Supabase real (RLS incluido) ANTES de construir cualquier UI de agenda/calendario en el frontend.

CREATE TABLE IF NOT EXISTS therapy_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    therapist_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 45,

    -- programada -> confirmada -> completada, o cancelada / no_asistio en cualquier punto antes de completada.
    status TEXT NOT NULL DEFAULT 'programada'
        CHECK (status IN ('programada', 'confirmada', 'completada', 'cancelada', 'no_asistio')),

    -- Enlace de videollamada (Google Meet, Zoom, Jitsi, etc.). Nulo hasta que el terapeuta lo asigne;
    -- el frontend debe tratar null como "aún no disponible", nunca ocultar el campo con un valor falso.
    video_call_link TEXT,

    -- Estado del recordatorio automático (para el futuro job/edge function que envíe notificaciones).
    -- No implica que el envío ya exista — solo modela el dato para cuando se construya ese flujo.
    reminder_status TEXT NOT NULL DEFAULT 'pendiente'
        CHECK (reminder_status IN ('pendiente', 'enviado', 'fallido', 'no_aplica')),

    notes TEXT,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_therapy_sessions_patient
    ON therapy_sessions (patient_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_therapy_sessions_therapist
    ON therapy_sessions (therapist_id, scheduled_at);

ALTER TABLE therapy_sessions ENABLE ROW LEVEL SECURITY;

-- Paciente: solo puede ver sus propias sesiones (no puede crear/editar/cancelar directamente;
-- eso lo controla el terapeuta o un admin, para evitar que un paciente reprograme sin acuerdo).
DROP POLICY IF EXISTS "Patients can view their own sessions" ON therapy_sessions;
CREATE POLICY "Patients can view their own sessions" ON therapy_sessions
    FOR SELECT
    USING (auth.uid() = patient_id);

-- Terapeuta: ve y gestiona (insert/update/delete) las sesiones de sus pacientes asignados.
DROP POLICY IF EXISTS "Therapists can view sessions of assigned patients" ON therapy_sessions;
CREATE POLICY "Therapists can view sessions of assigned patients" ON therapy_sessions
    FOR SELECT
    USING (
        auth.uid() = therapist_id
        AND EXISTS (
            SELECT 1 FROM patient_therapist
            WHERE patient_therapist.therapist_id = auth.uid()
            AND patient_therapist.patient_id = therapy_sessions.patient_id
        )
    );

DROP POLICY IF EXISTS "Therapists can create sessions for assigned patients" ON therapy_sessions;
CREATE POLICY "Therapists can create sessions for assigned patients" ON therapy_sessions
    FOR INSERT
    WITH CHECK (
        auth.uid() = therapist_id
        AND EXISTS (
            SELECT 1 FROM patient_therapist
            WHERE patient_therapist.therapist_id = auth.uid()
            AND patient_therapist.patient_id = therapy_sessions.patient_id
        )
    );

DROP POLICY IF EXISTS "Therapists can update sessions of assigned patients" ON therapy_sessions;
CREATE POLICY "Therapists can update sessions of assigned patients" ON therapy_sessions
    FOR UPDATE
    USING (
        auth.uid() = therapist_id
        AND EXISTS (
            SELECT 1 FROM patient_therapist
            WHERE patient_therapist.therapist_id = auth.uid()
            AND patient_therapist.patient_id = therapy_sessions.patient_id
        )
    )
    WITH CHECK (
        auth.uid() = therapist_id
        AND EXISTS (
            SELECT 1 FROM patient_therapist
            WHERE patient_therapist.therapist_id = auth.uid()
            AND patient_therapist.patient_id = therapy_sessions.patient_id
        )
    );

DROP POLICY IF EXISTS "Therapists can delete sessions of assigned patients" ON therapy_sessions;
CREATE POLICY "Therapists can delete sessions of assigned patients" ON therapy_sessions
    FOR DELETE
    USING (
        auth.uid() = therapist_id
        AND EXISTS (
            SELECT 1 FROM patient_therapist
            WHERE patient_therapist.therapist_id = auth.uid()
            AND patient_therapist.patient_id = therapy_sessions.patient_id
        )
    );

-- Admin: acceso total (mismo patrón que clinical_alerts / patient_anamnesis).
DROP POLICY IF EXISTS "Admins can manage all sessions" ON therapy_sessions;
CREATE POLICY "Admins can manage all sessions" ON therapy_sessions
    FOR ALL
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
    );

-- Trigger simple para mantener updated_at al día en cada UPDATE (no existía este patrón aún en el
-- esquema; se agrega aquí de forma autocontenida para no depender de una función compartida futura).
CREATE OR REPLACE FUNCTION set_therapy_sessions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_therapy_sessions_updated_at ON therapy_sessions;
CREATE TRIGGER trg_therapy_sessions_updated_at
    BEFORE UPDATE ON therapy_sessions
    FOR EACH ROW
    EXECUTE FUNCTION set_therapy_sessions_updated_at();
