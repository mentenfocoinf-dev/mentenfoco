-- Mensajería directa paciente↔terapeuta. Última pieza que estaba en cero (sin tabla ni servicio).
-- Modelo: como cada paciente tiene un terapeuta asignado (patient_therapist), la conversación es el
-- par (patient_id, therapist_id) — no hace falta una tabla `conversations` aparte. Cada mensaje
-- guarda quién lo envió (sender_id), que debe ser uno de los dos participantes.
--
-- SEGURIDAD: por decisión explícita del usuario, la seguridad (RLS) se atiende en una fase final,
-- y actualmente RLS está DESACTIVADO en el resto del esquema (psychometric_evaluations,
-- clinical_alerts, patient_anamnesis, therapy_sessions). Esta tabla sigue el mismo estado: se crea
-- SIN habilitar RLS. Las policies previstas quedan documentadas (comentadas) más abajo para aplicarse
-- en el sprint de seguridad, con el mismo patrón ya probado en therapy_sessions.

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    therapist_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    body TEXT NOT NULL CHECK (length(btrim(body)) > 0),
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    -- El emisor debe ser uno de los dos participantes de la conversación.
    CONSTRAINT messages_sender_is_participant CHECK (sender_id = patient_id OR sender_id = therapist_id)
);

-- Traer una conversación completa en orden cronológico.
CREATE INDEX IF NOT EXISTS idx_messages_conversation
    ON messages (patient_id, therapist_id, created_at);
-- Bandeja del terapeuta: mensajes no leídos por paciente (para contadores/orden).
CREATE INDEX IF NOT EXISTS idx_messages_therapist_unread
    ON messages (therapist_id, read_at)
    WHERE read_at IS NULL;

-- Realtime: que ambos lados reciban mensajes nuevos en vivo (mismo mecanismo que clinical_alerts).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE messages;
    END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- FASE DE SEGURIDAD (NO habilitar todavía — RLS está desactivado en todo el esquema por decisión
-- del usuario). Cuando llegue el sprint de seguridad, descomentar este bloque:
--
-- ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
--
-- -- El paciente ve y envía en su propia conversación.
-- CREATE POLICY "Patients read their own messages" ON messages
--     FOR SELECT USING (auth.uid() = patient_id);
-- CREATE POLICY "Patients send as themselves" ON messages
--     FOR INSERT WITH CHECK (auth.uid() = patient_id AND sender_id = patient_id);
--
-- -- El terapeuta ve y envía solo con sus pacientes asignados.
-- CREATE POLICY "Therapists read assigned conversations" ON messages
--     FOR SELECT USING (
--         auth.uid() = therapist_id AND EXISTS (
--             SELECT 1 FROM patient_therapist pt
--             WHERE pt.therapist_id = auth.uid() AND pt.patient_id = messages.patient_id
--         )
--     );
-- CREATE POLICY "Therapists send to assigned patients" ON messages
--     FOR INSERT WITH CHECK (
--         auth.uid() = therapist_id AND sender_id = therapist_id AND EXISTS (
--             SELECT 1 FROM patient_therapist pt
--             WHERE pt.therapist_id = auth.uid() AND pt.patient_id = messages.patient_id
--         )
--     );
--
-- -- Marcar como leído: el receptor puede actualizar read_at de los mensajes de su conversación.
-- CREATE POLICY "Participants mark messages read" ON messages
--     FOR UPDATE USING (auth.uid() = patient_id OR auth.uid() = therapist_id)
--     WITH CHECK (auth.uid() = patient_id OR auth.uid() = therapist_id);
--
-- -- Admin: acceso total.
-- CREATE POLICY "Admins manage all messages" ON messages
--     FOR ALL USING (
--         EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
--     ) WITH CHECK (
--         EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
--     );
-- ─────────────────────────────────────────────────────────────────────────────
