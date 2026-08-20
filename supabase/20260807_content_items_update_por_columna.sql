-- ============================================================================
-- `content_items`: se sustituye el UPDATE de tabla de `authenticated` por
-- UPDATE por columna, limitado a lo que el flujo editorial escribe de verdad.
--
-- Alcance: ACL. No se toca React, ni triggers, ni la máquina de estados, ni
-- RLS, ni funciones SQL, ni otras tablas, ni otros roles, ni otros privilegios.
-- `trg_content_authorization` sigue siendo exactamente el mismo.
--
-- ── Las 17 columnas que sí se conceden, y quién las escribe ─────────────────
--
--   updateContentDraft      (contentService.ts:339, patch = ContentDraftInput)
--     content_type · audio_kind · categoria · titulo · resumen_breve ·
--     body_md · tiempo_lectura
--
--   submitForReview         (:347)   status · review_notes
--   approveContent          (:383)   status · reviewed_by · reviewed_at · review_notes
--   requestContentChanges   (:400)   status · reviewed_by · reviewed_at · review_notes
--   publishContent          (:427)   slug · meta_title · meta_description ·
--                                    min_plan · status · published_by · published_at
--   archiveContent          (:447)   status
--
-- `createContentDraft` (:328) es un INSERT, no un UPDATE: no interviene aquí.
-- El único escritor de `content_items` en todo `src/` es `contentService.ts`.
--
-- ── Las 15 columnas que dejan de ser escribibles ────────────────────────────
--
--   id · author_id · created_at · updated_at · admite_comentarios ·
--   cover_image · en_resumen · faq · key_takeaway · clinical_refs ·
--   audio_url · external_embed_url · program_steps · tags · theme_key
--
-- Ninguna aparece en un `.update(` del frontend. Las diez de contenido
-- enriquecido (`cover_image` … `theme_key`) solo figuran en las interfaces de
-- lectura de `contentService.ts:90-113`; hoy las siembra `service_role`, que
-- conserva el UPDATE de tabla íntegro.
--
-- `updated_at` merece una nota: lo asigna el trigger
-- `set_content_items_updated_at`. Los privilegios de columna se comprueban
-- contra las columnas NOMBRADAS en la sentencia, no contra las que asigna un
-- trigger BEFORE, así que retirarlo no rompe el sellado de fecha. Queda
-- verificado ejecutando el flujo completo.
--
-- ── Qué gana esto sobre el trigger ──────────────────────────────────────────
--
-- `trg_content_authorization` ya rechaza tocar `id`, `author_id` y
-- `created_at`. Con esto el rechazo ocurre ANTES, en la comprobación de
-- privilegios, sin llegar a ejecutar la función. Es defensa en capas: si algún
-- día el trigger se desactivara o cambiara, estas cinco columnas seguirían
-- fuera del alcance de `authenticated`.
--
-- ── Idempotencia ────────────────────────────────────────────────────────────
--
-- `REVOKE ... ON TABLE` retira también las concesiones por columna del mismo
-- privilegio, así que la segunda pasada las quita y el `GRANT` las vuelve a
-- poner. El estado final es idéntico. Aplicada dos veces con éxito.
--
-- ── Reversión ───────────────────────────────────────────────────────────────
--
-- `supabase/backups/20260807_pre_content_items_update_por_columna.sql`
-- ============================================================================

REVOKE UPDATE ON TABLE public.content_items FROM authenticated;

GRANT UPDATE (
  -- edición del autor
  content_type,
  audio_kind,
  categoria,
  titulo,
  resumen_breve,
  body_md,
  tiempo_lectura,
  -- máquina de estados
  status,
  -- revisión
  reviewed_by,
  reviewed_at,
  review_notes,
  -- publicación
  slug,
  meta_title,
  meta_description,
  min_plan,
  published_by,
  published_at
) ON TABLE public.content_items TO authenticated;
