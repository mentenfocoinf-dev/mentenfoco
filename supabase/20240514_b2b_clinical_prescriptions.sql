-- =========================================================================================
-- ESQUEMA B2B: INFORME CLÍNICO Y PRESCRIPCIONES
-- =========================================================================================

-- 1. Historización de Evaluaciones Psicométricas
CREATE TABLE IF NOT EXISTS psychometric_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    therapist_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    scale_type TEXT NOT NULL CHECK (scale_type IN ('phq9', 'gad7', 'cssrs', 'auditc')),
    total_score INTEGER NOT NULL,
    severity_level TEXT,
    raw_answers JSONB,
    evaluated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Catálogo de Prescripciones Clínicas
CREATE TABLE IF NOT EXISTS clinical_prescriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo TEXT NOT NULL,
    objetivo_clinico TEXT NOT NULL,
    instruccion_paciente TEXT NOT NULL
);

-- 3. Asignación de Prescripciones a Pacientes
CREATE TABLE IF NOT EXISTS patient_prescriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    therapist_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    prescription_id UUID REFERENCES clinical_prescriptions(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed BOOLEAN DEFAULT false
);

-- =========================================================================================
-- SEGURIDAD (ROW LEVEL SECURITY)
-- =========================================================================================

ALTER TABLE psychometric_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_prescriptions ENABLE ROW LEVEL SECURITY;

-- Los terapeutas pueden ver las evaluaciones de los pacientes que tienen asignados
CREATE POLICY "Therapists can view evaluations of assigned patients"
ON psychometric_evaluations FOR SELECT
USING (auth.uid() = therapist_id);

-- Los pacientes pueden ver sus propias evaluaciones
CREATE POLICY "Patients can view their own evaluations"
ON psychometric_evaluations FOR SELECT
USING (auth.uid() = patient_id);

-- Todo el mundo puede leer el catálogo de prescripciones (es de solo lectura)
CREATE POLICY "Anyone authenticated can read clinical prescriptions"
ON clinical_prescriptions FOR SELECT
USING (auth.role() = 'authenticated');

-- Los terapeutas pueden asignar (INSERT) y leer prescripciones de sus pacientes
CREATE POLICY "Therapists can view assigned prescriptions"
ON patient_prescriptions FOR SELECT
USING (auth.uid() = therapist_id);

CREATE POLICY "Therapists can assign prescriptions"
ON patient_prescriptions FOR INSERT
WITH CHECK (auth.uid() = therapist_id);

-- Los pacientes pueden leer y actualizar el estado de completado de sus prescripciones
CREATE POLICY "Patients can view their assigned prescriptions"
ON patient_prescriptions FOR SELECT
USING (auth.uid() = patient_id);

CREATE POLICY "Patients can update their prescription status"
ON patient_prescriptions FOR UPDATE
USING (auth.uid() = patient_id)
WITH CHECK (auth.uid() = patient_id);

-- =========================================================================================
-- DATOS SEMILLA (MOCK 14 TAREAS DE INTERVENCIÓN)
-- =========================================================================================

INSERT INTO clinical_prescriptions (titulo, objetivo_clinico, instruccion_paciente) VALUES
('Respiración Diafragmática (4-7-8)', 'Activación del sistema parasimpático para reducir ansiedad aguda.', 'Inhala por la nariz en 4 segundos, mantén la respiración 7 segundos y exhala lentamente por la boca en 8 segundos. Repite 4 veces seguidas, idealmente 3 veces al día o durante un ataque de pánico.'),
('Registro de Pensamientos Automáticos', 'Reestructuración cognitiva y toma de conciencia de la tríada cognitiva.', 'Cada vez que sientas un cambio brusco de humor, anota en una libreta: 1) La situación, 2) Lo que pensaste en ese exacto momento, 3) La emoción (0-100), 4) Qué evidencia hay de que tu pensamiento sea 100% real.'),
('Activación Conductual Matutina', 'Combatir la inercia letárgica propia del cuadro depresivo.', 'Mañana, independientemente de cómo te sientas, levántate a las 8:00 AM, tiende la cama y camina fuera de casa durante 15 minutos. No es necesario disfrutarlo al principio, solo hacerlo.'),
('Técnica de Grounding (5-4-3-2-1)', 'Desconexión de la rumiación o desrealización reconectando con el presente.', 'Nombra en voz alta: 5 cosas que puedas ver, 4 que puedas tocar, 3 que escuches, 2 que puedas oler y 1 que puedas saborear.'),
('Caja de Herramientas de Tolerancia al Malestar (TIPP)', 'Manejo de crisis de desregulación emocional intensa sin autolesión.', 'Cuando la angustia llegue a 9/10, cambia tu temperatura (agua muy fría en el rostro), haz ejercicio intenso (correr en el sitio 1 min), respira pausadamente e implementa relajación muscular progresiva.'),
('Exposición Gradual Imaginada', 'Desensibilización sistemática a un estímulo fóbico o evento traumático.', 'Dedica 10 minutos al día para visualizar el evento temido, manteniéndote en la imagen sin escapar mentalmente hasta que notes que tu ansiedad basal se reduce a la mitad.'),
('Programación del Tiempo de Preocupación', 'Contención de la rumiación obsesiva y ansiedad generalizada.', 'Asigna un "horario de preocupación" estricto (ej. 6:00 a 6:30 PM). Si una preocupación surge fuera de esa hora, anótala y oblígate a posponer su análisis hasta la hora designada.'),
('Identificación de Valores Fundamentales', 'Intervención de Terapia de Aceptación y Compromiso (ACT).', 'Haz una lista de 3 áreas de tu vida (Ej: Familia, Trabajo, Salud) y describe cómo sería la versión de ti mismo que más te haría sentir orgulloso en cada una de ellas.'),
('Defusión Cognitiva ("El pasajero en el bus")', 'Distanciamiento de pensamientos intrusivos egodistónicos.', 'Visualiza tus pensamientos como pasajeros ruidosos en un autobús que tú conduces. Ellos pueden gritar e intentar distraerte, pero tú decides hacia dónde girar el volante de tu vida hoy.'),
('Higiene del Sueño Estricta', 'Regulación del ritmo circadiano.', 'Esta semana, acuéstate y levántate exactamente a la misma hora todos los días. Apaga pantallas 60 minutos antes de dormir y saca el teléfono de tu habitación.'),
('Experimento Conductual', 'Poner a prueba creencias irracionales de la fobia social.', 'Esta semana iniciarás una pequeña conversación trivial (ej. preguntar la hora o el clima) a un desconocido o al cajero del supermercado y anotarás si la catástrofe que predijiste realmente ocurrió.'),
('Economía de Fichas (Crianza)', 'Modificación conductual infantil / TDAH.', 'Establece 3 reglas claras con tu hijo. Cada vez que cumpla una, pon una estrella visible en su pizarra. A las 10 estrellas obtendrá el premio acordado. Evita castigos físicos o gritos.'),
('Tiempo Fuera (Timeout) en Pareja', 'Prevención de la escalada de agresividad en el conflicto.', 'Cuando noten que el tono de voz sube y el ritmo cardíaco se acelera, digan "Tiempo fuera". Sepárense físicamente a cuartos distintos durante 20 minutos sin hablar. Al regresar, retomen el tema con un volumen de voz bajo.'),
('Inventario de Gratitud', 'Modificación del sesgo atencional hacia lo negativo.', 'Cada noche, antes de dormir, escribe 3 cosas específicas y concretas que salieron bien ese día y por las cuales te sientes agradecido, aunque sean muy pequeñas (ej. "el café estaba caliente").')
ON CONFLICT DO NOTHING;
