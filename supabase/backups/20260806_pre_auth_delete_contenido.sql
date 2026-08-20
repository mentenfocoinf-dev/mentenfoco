-- ============================================================================
-- BACKUP — privilegios destructivos de `authenticated` sobre los 7 objetos de
-- contenido público, ANTES del sprint. Capturado de pg_class.relacl y
-- has_table_privilege el 2026-08-06.
--
-- ── ACL literal de partida (idéntica en los siete) ──────────────────────────
--
--   postgres=arwdDxtm/postgres ; anon=rxtm/postgres ;
--   authenticated=arwdDxtm/postgres ; service_role=arwdDxtm/postgres
--
--   a=INSERT r=SELECT w=UPDATE d=DELETE D=TRUNCATE x=REFERENCES t=TRIGGER m=MAINTAIN
--
-- `authenticated` tenía la ACL completa (`arwdDxtm`) en los siete:
--
--   content_items        [tabla] 26 filas   DELETE=true TRUNCATE=true
--   content_items_meta   [vista] 26 filas   DELETE=true TRUNCATE=true
--   clinical_guides      [tabla] 20 filas   DELETE=true TRUNCATE=true
--   clinical_guides_meta [vista] 20 filas   DELETE=true TRUNCATE=true
--   guides               [tabla]  0 filas   DELETE=true TRUNCATE=true
--   cie11_directory      [tabla] 163 filas  DELETE=true TRUNCATE=true
--   public_tests         [tabla]  3 filas   DELETE=true TRUNCATE=true
--
-- Ejecutar este archivo devuelve exactamente ese estado.
--
-- Nota: se restaura TRUNCATE también en las dos vistas porque el bit `D` estaba
-- presente en su ACL de partida. Que PostgreSQL no permita truncar una vista no
-- cambia lo que había concedido, y una reversión debe devolver el estado
-- previo, no una versión mejorada de él.
-- ============================================================================

GRANT DELETE, TRUNCATE ON public.content_items        TO authenticated;
GRANT DELETE, TRUNCATE ON public.content_items_meta   TO authenticated;
GRANT DELETE, TRUNCATE ON public.clinical_guides      TO authenticated;
GRANT DELETE, TRUNCATE ON public.clinical_guides_meta TO authenticated;
GRANT DELETE, TRUNCATE ON public.guides               TO authenticated;
GRANT DELETE, TRUNCATE ON public.cie11_directory      TO authenticated;
GRANT DELETE, TRUNCATE ON public.public_tests         TO authenticated;
