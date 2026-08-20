-- ============================================================================
-- BACKUP — privilegios `REFERENCES` y `TRIGGER` de `authenticated` sobre las 30
-- tablas de `public` que los conservaban, ANTES del sprint 4N.
-- Capturado de `pg_class.relacl` el 2026-08-08.
--
-- ── Estado de partida ───────────────────────────────────────────────────────
--
-- Las treinta tenían `x` (REFERENCES) y `t` (TRIGGER) para `authenticated`, con
-- distintos privilegios de datos según la tabla:
--
--   [raw--xtm]  blog_comments · clinical_alerts · clinical_consents ·
--               clinical_documents · clinical_notes · clinical_prescriptions ·
--               clinical_recommendations · clinical_tasks · content_revisions ·
--               crm_leads · crm_notes · family_genograms · messages ·
--               mood_entries · patient_anamnesis · patient_prescriptions ·
--               psychometric_evaluations · public_test_submissions ·
--               service_requests · telemetry_events · test_scores ·
--               user_guide_progress
--   [r----xtm]  cie11_directory · clinical_guides · guides · public_tests
--   [-a---xtm]  journey_events
--   [--w--xtm]  patient_therapist
--   [ra---xtm]  profiles
--   [-aw--xtm]  therapy_sessions
--
-- Letras: a=INSERT r=SELECT w=UPDATE d=DELETE D=TRUNCATE x=REFERENCES
--         t=TRIGGER m=MAINTAIN
--
-- Las siete tablas de `public` que ya NO los tenían quedan fuera y no aparecen
-- aquí: `appointments`, `content_items`, `notifications`,
-- `therapist_contact_requests`, `therapist_profiles`, `therapist_time_blocks`,
-- `user_preferences`.
--
-- ── Qué revierte este archivo ───────────────────────────────────────────────
--
-- Devuelve exactamente los dos privilegios que retira la migración, solo para
-- `authenticated`, solo en estas treinta tablas. No toca `SELECT`, `INSERT`,
-- `UPDATE`, `DELETE`, `TRUNCATE` ni `MAINTAIN`, ni ningún otro rol, ni los
-- triggers, funciones o claves ajenas existentes — la migración tampoco.
--
-- Sin `CASCADE`. `GRANT` es idempotente: repetirlo no cambia nada.
--
-- ⚠️ Restaurar estos privilegios reabre H-TRIGGER-001: con `TRIGGER` sobre
-- `profiles`, un paciente puede colgar un trigger que fije `NEW.role='admin'`
-- y escalar a administrador, porque los privilegios de columna se comprueban
-- contra las columnas nombradas en la sentencia, no contra las que asigna un
-- trigger. Está medido en el sprint 4M.
-- ============================================================================

GRANT REFERENCES, TRIGGER ON TABLE public.blog_comments            TO authenticated;
GRANT REFERENCES, TRIGGER ON TABLE public.cie11_directory          TO authenticated;
GRANT REFERENCES, TRIGGER ON TABLE public.clinical_alerts          TO authenticated;
GRANT REFERENCES, TRIGGER ON TABLE public.clinical_consents        TO authenticated;
GRANT REFERENCES, TRIGGER ON TABLE public.clinical_documents       TO authenticated;
GRANT REFERENCES, TRIGGER ON TABLE public.clinical_guides          TO authenticated;
GRANT REFERENCES, TRIGGER ON TABLE public.clinical_notes           TO authenticated;
GRANT REFERENCES, TRIGGER ON TABLE public.clinical_prescriptions   TO authenticated;
GRANT REFERENCES, TRIGGER ON TABLE public.clinical_recommendations TO authenticated;
GRANT REFERENCES, TRIGGER ON TABLE public.clinical_tasks           TO authenticated;
GRANT REFERENCES, TRIGGER ON TABLE public.content_revisions        TO authenticated;
GRANT REFERENCES, TRIGGER ON TABLE public.crm_leads                TO authenticated;
GRANT REFERENCES, TRIGGER ON TABLE public.crm_notes                TO authenticated;
GRANT REFERENCES, TRIGGER ON TABLE public.family_genograms         TO authenticated;
GRANT REFERENCES, TRIGGER ON TABLE public.guides                   TO authenticated;
GRANT REFERENCES, TRIGGER ON TABLE public.journey_events           TO authenticated;
GRANT REFERENCES, TRIGGER ON TABLE public.messages                 TO authenticated;
GRANT REFERENCES, TRIGGER ON TABLE public.mood_entries             TO authenticated;
GRANT REFERENCES, TRIGGER ON TABLE public.patient_anamnesis        TO authenticated;
GRANT REFERENCES, TRIGGER ON TABLE public.patient_prescriptions    TO authenticated;
GRANT REFERENCES, TRIGGER ON TABLE public.patient_therapist        TO authenticated;
GRANT REFERENCES, TRIGGER ON TABLE public.profiles                 TO authenticated;
GRANT REFERENCES, TRIGGER ON TABLE public.psychometric_evaluations TO authenticated;
GRANT REFERENCES, TRIGGER ON TABLE public.public_test_submissions  TO authenticated;
GRANT REFERENCES, TRIGGER ON TABLE public.public_tests             TO authenticated;
GRANT REFERENCES, TRIGGER ON TABLE public.service_requests         TO authenticated;
GRANT REFERENCES, TRIGGER ON TABLE public.telemetry_events         TO authenticated;
GRANT REFERENCES, TRIGGER ON TABLE public.test_scores              TO authenticated;
GRANT REFERENCES, TRIGGER ON TABLE public.therapy_sessions         TO authenticated;
GRANT REFERENCES, TRIGGER ON TABLE public.user_guide_progress      TO authenticated;
