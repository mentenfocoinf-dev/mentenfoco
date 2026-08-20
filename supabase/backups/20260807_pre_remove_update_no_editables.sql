-- ============================================================================
-- BACKUP — privilegio `UPDATE` de `authenticated` sobre los seis objetos de
-- contenido sin edición funcional, ANTES del sprint 4C.
-- Capturado de `pg_class.relacl` el 2026-08-07.
--
-- ── Estado literal de partida ───────────────────────────────────────────────
--
--   clinical_guides       tabla · 20 filas
--     {postgres=arwdDxtm/postgres,anon=rxtm/postgres,
--      authenticated=arwxtm/postgres,service_role=arwdDxtm/postgres}
--
--   clinical_guides_meta  vista · 20 filas
--     {postgres=arwdDxtm/postgres,anon=rxtm/postgres,
--      authenticated=arwDxtm/postgres,service_role=arwdDxtm/postgres}
--
--   guides                tabla · 0 filas
--     {postgres=arwdDxtm/postgres,anon=rxtm/postgres,
--      authenticated=arwxtm/postgres,service_role=arwdDxtm/postgres}
--
--   cie11_directory       tabla · 163 filas
--     {postgres=arwdDxtm/postgres,anon=rxtm/postgres,
--      authenticated=arwxtm/postgres,service_role=arwdDxtm/postgres}
--
--   public_tests          tabla · 3 filas
--     {postgres=arwdDxtm/postgres,anon=rxtm/postgres,
--      authenticated=arwxtm/postgres,service_role=arwdDxtm/postgres}
--
--   content_items_meta    vista · 26 filas
--     {postgres=arwdDxtm/postgres,anon=rxtm/postgres,
--      authenticated=arwDxtm/postgres,service_role=arwdDxtm/postgres}
--
-- Letras: a=INSERT r=SELECT w=UPDATE d=DELETE D=TRUNCATE x=REFERENCES
--         t=TRIGGER m=MAINTAIN
--
-- Los seis con owner `postgres` y RLS `false`. Sin grants por columna para
-- `authenticated` fuera del nivel de tabla, en ninguno.
--
-- ── Qué revierte este archivo ───────────────────────────────────────────────
--
-- Devuelve exactamente el único privilegio que retira la migración: `UPDATE`
-- para `authenticated`. No toca `SELECT`, `INSERT`, `DELETE`, `TRUNCATE`,
-- `REFERENCES`, `TRIGGER` ni `MAINTAIN`, ni ningún otro rol, porque la
-- migración tampoco los toca.
--
-- `GRANT` es idempotente: repetirlo no cambia nada.
-- ============================================================================

GRANT UPDATE ON TABLE public.clinical_guides      TO authenticated;
GRANT UPDATE ON TABLE public.clinical_guides_meta TO authenticated;
GRANT UPDATE ON TABLE public.guides               TO authenticated;
GRANT UPDATE ON TABLE public.cie11_directory      TO authenticated;
GRANT UPDATE ON TABLE public.public_tests         TO authenticated;
GRANT UPDATE ON TABLE public.content_items_meta   TO authenticated;
