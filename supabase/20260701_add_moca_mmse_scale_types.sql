-- Agrega 'moca' y 'mmse' como scale_type válidos en psychometric_evaluations. 'phq9', 'gad7', 'cssrs'
-- y 'auditc' ya estaban permitidos (el CHECK constraint original ya preveía C-SSRS y AUDIT-C, solo
-- faltaban los cribados cognitivos). Ver 06_Recomendaciones_Implementacion_Tecnica.md punto 2.

ALTER TABLE psychometric_evaluations DROP CONSTRAINT IF EXISTS psychometric_evaluations_scale_type_check;
ALTER TABLE psychometric_evaluations
    ADD CONSTRAINT psychometric_evaluations_scale_type_check
    CHECK (scale_type = ANY (ARRAY['phq9', 'gad7', 'cssrs', 'auditc', 'moca', 'mmse']));
