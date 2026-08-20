-- ============================================================================
-- BACKUP — privilegios `DELETE` y `TRUNCATE` de `authenticated` sobre 14
-- tablas, ANTES del sprint 4L. Capturado de `pg_class.relacl` el 2026-08-08.
--
-- ── Estado de partida ───────────────────────────────────────────────────────
--
-- Las catorce tenían `authenticated=arwdDxtm` — los ocho privilegios:
--
--   blog_comments             2 filas   trg_blog_comment_moderation
--   clinical_documents        0 filas   —
--   clinical_prescriptions   14 filas   —
--   clinical_recommendations  0 filas   —
--   clinical_tasks            0 filas   —
--   content_revisions         0 filas   —
--   crm_leads                 0 filas   —
--   crm_notes                 0 filas   —
--   family_genograms          0 filas   —
--   public_test_submissions   5 filas   trg_submission_append_only
--   service_requests          1 fila    —
--   telemetry_events          0 filas   —
--   test_scores               0 filas   tr_evaluate_phq9_risk
--   user_guide_progress       0 filas   —
--
-- Letras: a=INSERT r=SELECT w=UPDATE d=DELETE D=TRUNCATE x=REFERENCES
--         t=TRIGGER m=MAINTAIN
--
-- Ninguno de los tres triggers se declara sobre `DELETE`, así que ninguno
-- protegía esta vía. Todas con owner `postgres` y RLS `false`.
--
-- ── Lo que este backup NO toca, porque la migración tampoco ─────────────────
--
-- `therapist_time_blocks` queda completamente fuera: conserva su
-- `authenticated=ad`, sus grants por columna (`id` y `therapist_id` con
-- `{authenticated=r}`) y su trigger `trg_time_block_ownership`. Es el único
-- `DELETE` con consumidor real —`deleteTimeBlock()` desde
-- `AgendaClinica.tsx:479`— y ya está protegido por propiedad.
--
-- Tampoco toca `patient_prescriptions`, ni `anon`, ni `service_role`, ni
-- `postgres`, ni RLS, ni triggers, ni funciones, ni grants por columna, ni
-- `REFERENCES`/`TRIGGER`/`MAINTAIN`.
--
-- ── Qué revierte ────────────────────────────────────────────────────────────
--
-- Devuelve exactamente los dos privilegios que retira la migración, solo para
-- `authenticated`, solo en estas catorce tablas.
--
-- Sin `CASCADE`. `GRANT` es idempotente: repetirlo no cambia nada.
-- ============================================================================

GRANT DELETE, TRUNCATE ON TABLE public.blog_comments            TO authenticated;
GRANT DELETE, TRUNCATE ON TABLE public.clinical_documents       TO authenticated;
GRANT DELETE, TRUNCATE ON TABLE public.clinical_prescriptions   TO authenticated;
GRANT DELETE, TRUNCATE ON TABLE public.clinical_recommendations TO authenticated;
GRANT DELETE, TRUNCATE ON TABLE public.clinical_tasks           TO authenticated;
GRANT DELETE, TRUNCATE ON TABLE public.content_revisions        TO authenticated;
GRANT DELETE, TRUNCATE ON TABLE public.crm_leads                TO authenticated;
GRANT DELETE, TRUNCATE ON TABLE public.crm_notes                TO authenticated;
GRANT DELETE, TRUNCATE ON TABLE public.family_genograms         TO authenticated;
GRANT DELETE, TRUNCATE ON TABLE public.public_test_submissions  TO authenticated;
GRANT DELETE, TRUNCATE ON TABLE public.service_requests         TO authenticated;
GRANT DELETE, TRUNCATE ON TABLE public.telemetry_events         TO authenticated;
GRANT DELETE, TRUNCATE ON TABLE public.test_scores              TO authenticated;
GRANT DELETE, TRUNCATE ON TABLE public.user_guide_progress      TO authenticated;
