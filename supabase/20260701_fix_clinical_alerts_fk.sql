-- clinical_alerts.test_score_id apuntaba a `test_scores`, una tabla previa y más simple (id,
-- patient_id, test_name, item_9_score, total_score, evaluated_at) que cubría el mismo propósito que
-- psychometric_evaluations pero sin severity_level, raw_answers ni soporte genérico de escalas.
-- Ambas tablas tenían 0 filas — nadie llegó a usar ninguna de las dos desde el frontend. El roadmap
-- (06_Recomendaciones_Implementacion_Tecnica.md) especifica construir sobre psychometric_evaluations,
-- así que se corrige la FK para que apunte ahí. test_scores queda sin usar pero no se borra en esta
-- migración (fuera de alcance de este ítem; decisión de limpieza separada).

ALTER TABLE clinical_alerts DROP CONSTRAINT IF EXISTS clinical_alerts_test_score_id_fkey;
ALTER TABLE clinical_alerts
    ADD CONSTRAINT clinical_alerts_test_score_id_fkey
    FOREIGN KEY (test_score_id) REFERENCES psychometric_evaluations(id) ON DELETE CASCADE;
