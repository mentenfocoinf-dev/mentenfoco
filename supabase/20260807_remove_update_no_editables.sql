-- ============================================================================
-- Retirada de `UPDATE` a `authenticated` sobre los seis objetos de contenido
-- que nadie edita.
--
-- Alcance: ACL. Nada más. No se tocan `content_items`, triggers, funciones,
-- RLS, políticas, React, RPC, Edge Functions, cron, `search_path` ni owners.
-- No se toca `service_role` ni `postgres`. No se toca `anon` — ya no tiene
-- `UPDATE` en ninguno desde el sprint 1.
--
-- ── Qué se retira ───────────────────────────────────────────────────────────
--
--   clinical_guides       tabla · 20 filas
--   clinical_guides_meta  vista · 20 filas
--   guides                tabla ·  0 filas
--   cie11_directory       tabla · 163 filas
--   public_tests          tabla ·  3 filas
--   content_items_meta    vista · 26 filas
--
-- Solo `UPDATE`. `SELECT`, `INSERT`, `DELETE`, `TRUNCATE`, `REFERENCES`,
-- `TRIGGER` y `MAINTAIN` quedan como estaban.
--
-- Las dos vistas son auto-actualizables (`is_updatable = YES`,
-- `is_trigger_updatable = NO`) y corren con los privilegios del propietario,
-- así que su `UPDATE` era una vía de escritura real hacia la tabla de base, no
-- un bit decorativo. `content_items_meta` se apoya en `content_items`: retirar
-- el privilegio de la VISTA no altera la ACL de la tabla, que este sprint deja
-- intacta a propósito.
--
-- ── Sin consumidores ────────────────────────────────────────────────────────
--
-- Revalidado sobre el estado actual, no sobre migraciones. Los catorce puntos
-- del frontend que tocan estos objetos son todos `.select(...)`:
--
--   contentService.ts:138,200,232   content_items_meta   listado y alcance
--   contentService.ts:210           clinical_guides_meta alcance por plan
--   clinicalService.ts:92,100       cie11_directory      búsqueda y catálogo
--   guidesService.ts:120            clinical_guides_meta listado por plan
--   guidesService.ts:142            clinical_guides      lectura de una guía
--   publicTestsService.ts:61,75     public_tests         listado y detalle
--   recommendationsService.ts:316   content_items_meta   recomendaciones
--   recommendationsService.ts:357   clinical_guides_meta recomendaciones
--
-- Cero coincidencias de `.update(`, `.upsert(`, `.insert(` o `.delete(` sobre
-- cualquiera de los seis. `guides` no aparece en el frontend: la data vive en
-- `clinical_guides` (`src/data/guiasData.ts:2`) y la tabla está vacía.
--
-- En la base: cero funciones escriben en los seis. El único trigger que llevan
-- es `trg_no_public_risk_instrument` sobre `public_tests`, que es una guardia,
-- no un escritor. El trabajo de cron no los cita. Las cuatro políticas que
-- existen están inertes (RLS `false`) y tres son de `SELECT`.
--
-- ── Idempotencia ────────────────────────────────────────────────────────────
--
-- `REVOKE` sobre un privilegio ausente no es un error. Ejecutable las veces
-- que haga falta.
--
-- ── Reversión ───────────────────────────────────────────────────────────────
--
-- `supabase/backups/20260807_pre_remove_update_no_editables.sql`
-- ============================================================================

REVOKE UPDATE ON TABLE public.clinical_guides      FROM authenticated;
REVOKE UPDATE ON TABLE public.clinical_guides_meta FROM authenticated;
REVOKE UPDATE ON TABLE public.guides               FROM authenticated;
REVOKE UPDATE ON TABLE public.cie11_directory      FROM authenticated;
REVOKE UPDATE ON TABLE public.public_tests         FROM authenticated;
REVOKE UPDATE ON TABLE public.content_items_meta   FROM authenticated;
