-- ============================================================================
-- Retirada de `INSERT` a `authenticated` sobre los seis objetos de contenido
-- que nadie crea desde la aplicación.
--
-- Alcance: ACL. Nada más. No se tocan `content_items`, triggers, funciones,
-- RLS, políticas, React, RPC, Edge Functions, cron, `search_path` ni owners.
-- No se toca `service_role` ni `postgres`. `anon` no tiene `INSERT` en ninguno
-- desde el sprint 1.
--
-- Continúa el 4C, que retiró `UPDATE` sobre los mismos seis. Con este, quedan
-- de solo lectura para `authenticated`.
--
-- ── Qué cierra ──────────────────────────────────────────────────────────────
--
-- El 4C dejó documentado, y demostrado, que un paciente cualquiera podía
-- CREAR filas en tres de ellos:
--
--     cie11_directory -> PUDO INSERTAR      (código diagnóstico inventado)
--     clinical_guides -> PUDO INSERTAR      (guía clínica falsa)
--     public_tests    -> PUDO INSERTAR      (instrumento psicométrico falso)
--
-- En una plataforma clínica eso pesa tanto como modificar lo existente: esas
-- filas aparecen en los listados, que filtran por `min_plan` o `activo`, no
-- por autoría. Un instrumento psicométrico falso es contenido clínico falso
-- delante de un paciente.
--
-- ── Sin consumidores ────────────────────────────────────────────────────────
--
-- Revalidado sobre el estado actual, no sobre migraciones.
--
--   · React: 22 puntos de `.insert(`/`.upsert(` en `src/`, ninguno contra los
--     seis. Búsqueda multilínea de `.from("<objeto>").insert|upsert`: cero.
--   · Edge Functions (4): no mencionan ninguno de los seis.
--   · Scripts de raíz:
--       - `seed_clinical_demo_data.cjs:113`  lee `cie11_directory` (`.select`)
--       - `seed_content_items.cjs:181`       lee `clinical_guides` (`.select`)
--         y escribe en `content_items` (`:226`, `:249`), fuera de alcance.
--       Ambos se autentican con `SERVICE_ROLE_KEY`, que conserva `INSERT`.
--       - `generate_sql.js:81` contiene un `INSERT INTO clinical_guides`, pero
--         solo IMPRIME texto SQL, no ejecuta nada; además describe un esquema
--         que ya no existe (`es_premium`, RLS activo).
--   · Base: cero funciones y cero triggers insertan en los seis. Ninguna
--     función expuesta a `anon` o `authenticated` los cita. El trabajo de cron
--     no los menciona.
--
-- Dos FK entrantes apuntan a este grupo:
--   `public_test_submissions.test_slug -> public_tests`
--   `user_guide_progress.guide_id      -> guides`
-- Insertar en la tabla hija NO requiere `INSERT` en la tabla padre: la
-- comprobación de integridad la ejecuta el sistema RI, no quien escribe. El
-- envío de un test público sigue funcionando, y así se verifica.
--
-- ── Idempotencia ────────────────────────────────────────────────────────────
--
-- `REVOKE` sobre un privilegio ausente no es un error. Ejecutable las veces
-- que haga falta.
--
-- ── Reversión ───────────────────────────────────────────────────────────────
--
-- `supabase/backups/20260807_pre_remove_insert_no_editables.sql`
-- ============================================================================

REVOKE INSERT ON TABLE public.clinical_guides      FROM authenticated;
REVOKE INSERT ON TABLE public.clinical_guides_meta FROM authenticated;
REVOKE INSERT ON TABLE public.guides               FROM authenticated;
REVOKE INSERT ON TABLE public.cie11_directory      FROM authenticated;
REVOKE INSERT ON TABLE public.public_tests         FROM authenticated;
REVOKE INSERT ON TABLE public.content_items_meta   FROM authenticated;
