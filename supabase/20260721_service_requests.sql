-- ============================================================================
-- Solicitudes de servicios adicionales (consulta extra, valoracion
-- neuropsicologica, aplicacion de pruebas).
--
-- La solicitud se registra aunque todavia no exista pasarela de pago: sin esta
-- tabla el formulario seria un punto muerto y el equipo clinico no tendria como
-- enterarse. El cobro se conectara despues; por eso quedan las columnas de
-- estado de pago preparadas pero sin uso.
-- ============================================================================

CREATE TABLE IF NOT EXISTS service_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  service_type text NOT NULL CHECK (service_type IN (
    'additional_consultation',
    'neuropsych_assessment',
    'psychometric_testing'
  )),
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'contacted',
    'scheduled',
    'completed',
    'cancelled'
  )),
  -- Preparado para la pasarela: se llenaran cuando exista checkout.
  payment_status text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN (
    'unpaid',
    'paid',
    'refunded'
  )),
  stripe_session_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- El panel del terapeuta consulta las pendientes por paciente.
CREATE INDEX IF NOT EXISTS service_requests_pending_idx
  ON service_requests (patient_id, created_at DESC)
  WHERE status = 'pending';

COMMENT ON TABLE service_requests IS
  'Solicitudes de servicios adicionales del paciente. El cobro se conecta en una fase posterior.';
COMMENT ON COLUMN service_requests.payment_status IS
  'Reservado para la pasarela de pago. Hoy toda solicitud nace unpaid y se gestiona manualmente.';

-- ============================================================================
-- FASE DE SEGURIDAD (no aplicar todavia: RLS esta desactivado a proposito).
--
-- ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Patients manage their own requests" ON service_requests
--   FOR ALL USING (patient_id = auth.uid());
-- CREATE POLICY "Staff read all requests" ON service_requests
--   FOR SELECT USING (get_my_role() = ANY (ARRAY['admin'::user_role, 'therapist'::user_role]));
-- ============================================================================
