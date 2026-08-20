-- ============================================================================
-- BACKUP — privilegios de `anon` sobre los 7 objetos de contenido público,
-- ANTES del sprint. Capturado de has_table_privilege el 2026-08-05.
--
-- Estado de partida, objeto por objeto (S=select I=insert U=update D=delete
-- T=truncate):
--
--   content_items ......... 26 filas ... anon=SIUDT
--   content_items_meta .... 26 filas ... anon=SIUDT   (vista)
--   clinical_guides ....... 20 filas ... anon=SIUDT
--   clinical_guides_meta .. 20 filas ... anon=SIUDT   (vista)
--   guides ................  0 filas ... anon=SIUDT
--   cie11_directory ...... 163 filas ... anon=SIUDT
--   public_tests ..........  3 filas ... anon=SIUDT
--
-- Además `anon` tenía REFERENCES y TRIGGER sobre los siete. NO se tocan en este
-- sprint: quedan documentados abajo como observación.
--
-- Ejecutar este archivo revierte el sprint por completo.
-- ============================================================================

GRANT INSERT, UPDATE, DELETE, TRUNCATE ON public.content_items        TO anon;
GRANT INSERT, UPDATE, DELETE, TRUNCATE ON public.content_items_meta   TO anon;
GRANT INSERT, UPDATE, DELETE, TRUNCATE ON public.clinical_guides      TO anon;
GRANT INSERT, UPDATE, DELETE, TRUNCATE ON public.clinical_guides_meta TO anon;
GRANT INSERT, UPDATE, DELETE, TRUNCATE ON public.guides               TO anon;
GRANT INSERT, UPDATE, DELETE, TRUNCATE ON public.cie11_directory      TO anon;
GRANT INSERT, UPDATE, DELETE, TRUNCATE ON public.public_tests         TO anon;
