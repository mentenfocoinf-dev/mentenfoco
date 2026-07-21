-- ============================================================================
-- Micro-registro diario de estado de animo.
--
-- Un unico registro por paciente y dia: volver a marcar el mismo dia actualiza
-- en lugar de acumular, que es el comportamiento esperado de un tracker.
-- La escala 1..5 es ordinal (muy mal .. muy bien) y NO es un instrumento
-- clinico: no alimenta alertas ni diagnostico, solo seguimiento personal.
-- ============================================================================

CREATE TABLE IF NOT EXISTS mood_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  entry_date date NOT NULL DEFAULT current_date,
  mood smallint NOT NULL CHECK (mood BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mood_entries_one_per_day UNIQUE (patient_id, entry_date)
);

CREATE INDEX IF NOT EXISTS mood_entries_patient_date_idx
  ON mood_entries (patient_id, entry_date DESC);

COMMENT ON TABLE mood_entries IS
  'Registro diario de animo del paciente. Seguimiento personal, no instrumento clinico.';
COMMENT ON COLUMN mood_entries.mood IS
  'Escala ordinal 1..5 (1 muy mal, 5 muy bien). No dispara alertas.';

-- ============================================================================
-- FASE DE SEGURIDAD (no aplicar todavia: RLS esta desactivado a proposito).
--
-- ALTER TABLE mood_entries ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Patients manage their own mood" ON mood_entries
--   FOR ALL USING (patient_id = auth.uid());
-- ============================================================================
