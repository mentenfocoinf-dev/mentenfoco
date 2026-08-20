-- ============================================================================
-- BACKUP — privilegio `INSERT` de `authenticated` sobre los seis objetos de
-- contenido, ANTES del sprint 4C.1.
-- Capturado de `pg_class.relacl` el 2026-08-07, ya con el 4C aplicado.
--
-- ── Estado literal de partida ───────────────────────────────────────────────
--
--   clinical_guides       tabla · 20 filas
--     {postgres=arwdDxtm/postgres,anon=rxtm/postgres,
--      authenticated=arxtm/postgres,service_role=arwdDxtm/postgres}
--
--   clinical_guides_meta  vista · 20 filas · is_insertable_into=YES
--     {postgres=arwdDxtm/postgres,anon=rxtm/postgres,
--      authenticated=arDxtm/postgres,service_role=arwdDxtm/postgres}
--
--   guides                tabla · 0 filas
--     {postgres=arwdDxtm/postgres,anon=rxtm/postgres,
--      authenticated=arxtm/postgres,service_role=arwdDxtm/postgres}
--
--   cie11_directory       tabla · 163 filas
--     {postgres=arwdDxtm/postgres,anon=rxtm/postgres,
--      authenticated=arxtm/postgres,service_role=arwdDxtm/postgres}
--
--   public_tests          tabla · 3 filas
--     {postgres=arwdDxtm/postgres,anon=rxtm/postgres,
--      authenticated=arxtm/postgres,service_role=arwdDxtm/postgres}
--
--   content_items_meta    vista · 26 filas · is_insertable_into=YES
--     {postgres=arwdDxtm/postgres,anon=rxtm/postgres,
--      authenticated=arDxtm/postgres,service_role=arwdDxtm/postgres}
--
-- Letras: a=INSERT r=SELECT w=UPDATE d=DELETE D=TRUNCATE x=REFERENCES
--         t=TRIGGER m=MAINTAIN
--
-- Los seis con owner `postgres` y RLS `false`. Sin grants por columna para
-- `authenticated` fuera del nivel de tabla. `has_table_privilege(...,'INSERT')`
-- = TRUE en los seis, incluidas las dos vistas, que son auto-insertables
-- (`is_trigger_insertable_into = NO`, sin `INSTEAD OF`).
--
-- ── Qué revierte este archivo ───────────────────────────────────────────────
--
-- Devuelve exactamente el único privilegio que retira la migración: `INSERT`
-- para `authenticated`. No toca nada más, porque la migración tampoco.
--
-- `GRANT` es idempotente: repetirlo no cambia nada.
-- ============================================================================

GRANT INSERT ON TABLE public.clinical_guides      TO authenticated;
GRANT INSERT ON TABLE public.clinical_guides_meta TO authenticated;
GRANT INSERT ON TABLE public.guides               TO authenticated;
GRANT INSERT ON TABLE public.cie11_directory      TO authenticated;
GRANT INSERT ON TABLE public.public_tests         TO authenticated;
GRANT INSERT ON TABLE public.content_items_meta   TO authenticated;
