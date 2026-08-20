-- ============================================================================
-- Estado de `public.profiles` ANTES del sprint 3, para revertirlo entero.
-- Capturado de information_schema/pg_catalog el 2026-08-05.
--
--   · authenticated: INSERT, SELECT, UPDATE, REFERENCES, TRIGGER sobre la tabla
--     (es decir, sobre las 21 columnas, sin restricción por columna).
--   · anon: sin privilegios (sprint 1).
--   · DELETE y TRUNCATE: revocados a ambos (sprint 2).
--   · RLS: OFF. 5 políticas escritas, inertes.
--   · Triggers sobre profiles: NINGUNO.
--
-- Ejecutar este archivo deshace el sprint 3 por completo.
-- ============================================================================

DROP TRIGGER IF EXISTS trg_profile_ownership ON public.profiles;
DROP FUNCTION IF EXISTS public.enforce_profile_ownership();
DROP FUNCTION IF EXISTS public.claim_session_token(uuid);
DROP FUNCTION IF EXISTS public.admin_set_status(uuid, text);

GRANT INSERT, SELECT, UPDATE, REFERENCES, TRIGGER ON public.profiles TO authenticated;
