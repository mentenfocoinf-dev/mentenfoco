-- ============================================================================
-- Trazabilidad de la resolucion de alertas de crisis (gap #4).
--
-- Hasta ahora dismissCrisisAlert() solo ocultaba la alerta en el cliente: al
-- recargar volvia a aparecer y no quedaba registro de quien la atendio ni que
-- hizo. En una alerta de riesgo suicida eso es un vacio de historia clinica.
--
-- Diseno: NO se reutiliza `status` para marcar el cierre. `status` describe la
-- gravedad con la que nacio la alerta ('high_priority') y debe conservarse para
-- auditoria; el estado de atencion vive en columnas propias. Una alerta esta
-- pendiente si resolved_at IS NULL.
-- ============================================================================

ALTER TABLE clinical_alerts
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS resolution_action text,
  ADD COLUMN IF NOT EXISTS resolution_notes text;

-- Acciones clinicamente significativas. 'no_action_needed' cubre el falso
-- positivo (p. ej. el paciente marco el item por error y lo aclara en sesion),
-- que debe poder registrarse de forma explicita en vez de descartarse en silencio.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.clinical_alerts'::regclass
      AND conname = 'clinical_alerts_resolution_action_check'
  ) THEN
    ALTER TABLE clinical_alerts
      ADD CONSTRAINT clinical_alerts_resolution_action_check
      CHECK (resolution_action IS NULL OR resolution_action IN (
        'contacted_patient',
        'session_scheduled',
        'referred_psychiatry',
        'emergency_services',
        'no_action_needed'
      ));
  END IF;
END $$;

-- Una alerta resuelta debe decir siempre quien y con que accion: cerrar sin
-- dejar rastro es justo lo que este cambio viene a impedir.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.clinical_alerts'::regclass
      AND conname = 'clinical_alerts_resolution_complete_check'
  ) THEN
    ALTER TABLE clinical_alerts
      ADD CONSTRAINT clinical_alerts_resolution_complete_check
      CHECK (
        resolved_at IS NULL
        OR (resolved_by IS NOT NULL AND resolution_action IS NOT NULL)
      );
  END IF;
END $$;

-- La bandeja del terapeuta consulta siempre alertas pendientes por paciente.
CREATE INDEX IF NOT EXISTS clinical_alerts_pending_idx
  ON clinical_alerts (patient_id, created_at DESC)
  WHERE resolved_at IS NULL;

COMMENT ON COLUMN clinical_alerts.status IS
  'Gravedad con la que se genero la alerta (high_priority). No se modifica al atenderla: el cierre se registra en resolved_at/resolved_by/resolution_action.';
COMMENT ON COLUMN clinical_alerts.resolved_at IS
  'Momento en que el terapeuta atendio la alerta. NULL = pendiente.';
COMMENT ON COLUMN clinical_alerts.resolution_action IS
  'Accion tomada por el terapeuta. Parte de la historia clinica: no se borra ni se sobrescribe.';
