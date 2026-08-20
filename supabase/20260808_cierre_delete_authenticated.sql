-- ============================================================================
-- Cierre de la destrucción por usuario con sesión: se retira `DELETE` y
-- `TRUNCATE` a `authenticated` en 14 tablas.
--
-- Alcance: dos privilegios, un rol, catorce tablas. Nada más. No se tocan
-- `SELECT`, `INSERT`, `UPDATE`, `REFERENCES`, `TRIGGER` ni `MAINTAIN`; ni
-- `anon`, `service_role` o `postgres`; ni RLS, políticas, triggers, funciones,
-- columnas, grants por columna, datos, React, `content_items`,
-- `patient_therapist` ni ninguna otra tabla.
--
-- ── Qué se cierra ───────────────────────────────────────────────────────────
--
-- La auditoría 4K midió que **cualquier usuario con sesión** —incluido un
-- paciente— podía borrar y vaciar estas catorce. Sonda no destructiva
-- (`DELETE ... WHERE false`, que exige el privilegio al planificar sin tocar
-- filas), ejecutada como paciente: `PUEDE` en las quince.
--
-- Lo más grave, por datos reales y por efecto en cadena:
--
--   clinical_prescriptions  14 filas, y `patient_prescriptions` la referencia
--                           con ON DELETE CASCADE: borrar el catálogo se lleva
--                           por delante las prescripciones ya asignadas.
--   public_test_submissions  5 filas de terceros
--   blog_comments            2 filas de terceros
--   service_requests         1 fila con `patient_id` y notas
--
-- Los tres triggers que existen en el grupo (`trg_blog_comment_moderation`,
-- `trg_submission_append_only`, `tr_evaluate_phq9_risk`) se declaran sobre
-- `INSERT`/`UPDATE`. **Ninguno cubre `DELETE`**, y un `TRUNCATE` no dispara
-- triggers de fila.
--
-- ── `therapist_time_blocks` queda intacta, a propósito ──────────────────────
--
-- Es la única de las quince con un `DELETE` que la aplicación usa de verdad:
-- `deleteTimeBlock()` (`timeBlocksService.ts:89`, desde `AgendaClinica.tsx:479`)
-- permite al terapeuta eliminar un bloqueo o unas vacaciones de su agenda. Ya
-- está protegida por propiedad: `trg_time_block_ownership` es el único trigger
-- del esquema declarado `BEFORE DELETE`, y responde `BLOCK_FORBIDDEN` a quien
-- no es el dueño —verificado ejecutando—. Su ACL ya venía recortada (`ad` más
-- grants de lectura por columna en `id` y `therapist_id`).
--
-- Esta migración no la nombra.
--
-- ── Sin consumidores de lo que se retira ────────────────────────────────────
--
-- Reconfirmado antes de aplicar: un único `.delete()` en todo `src/`, y es el
-- de `therapist_time_blocks`. Cero `DELETE FROM` o `TRUNCATE` en React, Edge
-- Functions, scripts y seeders. Cero funciones SQL y cero triggers que borren
-- en estas catorce. El trabajo de cron no borra nada.
--
-- ── Idempotencia ────────────────────────────────────────────────────────────
--
-- `REVOKE` sobre un privilegio ausente no es un error. Sin `CASCADE`.
-- Ejecutable las veces que haga falta: el estado final es el mismo.
--
-- ── Reversión ───────────────────────────────────────────────────────────────
--
-- `supabase/backups/20260808_pre_cierre_delete_authenticated.sql`
-- ============================================================================

REVOKE DELETE, TRUNCATE ON TABLE public.blog_comments            FROM authenticated;
REVOKE DELETE, TRUNCATE ON TABLE public.clinical_documents       FROM authenticated;
REVOKE DELETE, TRUNCATE ON TABLE public.clinical_prescriptions   FROM authenticated;
REVOKE DELETE, TRUNCATE ON TABLE public.clinical_recommendations FROM authenticated;
REVOKE DELETE, TRUNCATE ON TABLE public.clinical_tasks           FROM authenticated;
REVOKE DELETE, TRUNCATE ON TABLE public.content_revisions        FROM authenticated;
REVOKE DELETE, TRUNCATE ON TABLE public.crm_leads                FROM authenticated;
REVOKE DELETE, TRUNCATE ON TABLE public.crm_notes                FROM authenticated;
REVOKE DELETE, TRUNCATE ON TABLE public.family_genograms         FROM authenticated;
REVOKE DELETE, TRUNCATE ON TABLE public.public_test_submissions  FROM authenticated;
REVOKE DELETE, TRUNCATE ON TABLE public.service_requests         FROM authenticated;
REVOKE DELETE, TRUNCATE ON TABLE public.telemetry_events         FROM authenticated;
REVOKE DELETE, TRUNCATE ON TABLE public.test_scores              FROM authenticated;
REVOKE DELETE, TRUNCATE ON TABLE public.user_guide_progress      FROM authenticated;
