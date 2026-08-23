-- ============================================================================
-- Item 2 — Directorio público de especialistas (Ola 3) + CORRECCIÓN DE SEGURIDAD.
--
-- HALLAZGO (ADR-013 — exposición de datos que no deberían ser públicos):
--   `therapist_profiles` tenía una política SELECT `USING(true)` para
--   {anon, authenticated}, es decir CUALQUIER anónimo podía leer por la API la
--   tabla ENTERA — TODAS las columnas (incluidas `license_number` = número de
--   tarjeta profesional, y `availability` = datos operativos de agenda) y TODAS
--   las filas (incluidas perfiles `active=false` / `verified=false`). Eso es
--   más de lo que un directorio público curado necesita.
--
-- DECISIÓN (aprobada 21-ago): cerrar la sobre-exposición con una VISTA pública
--   de columnas allowlist, filtrada a active+verified, y quitar el acceso
--   anónimo directo a la tabla base. El matching del portal (authenticated)
--   sigue leyendo la base sin cambios. `license_number` queda solo para
--   autenticados (no entra en la vista pública).
--
-- REGLA EN LA BASE, no en la interfaz (ADR-011): confiar en que el frontend
--   seleccione columnas seguras NO protege — anon podía consultar la columna
--   directo. La barrera va en la base: vista curada + revoke.
--
-- Backup / rollback: supabase/backups/20260821_pre_public_therapist_directory.sql
-- Idempotente: se dropean AMBAS políticas por nombre antes de crear (CREATE
-- POLICY no admite IF NOT EXISTS) + CREATE OR REPLACE VIEW + GRANT.
-- ============================================================================

BEGIN;

-- 1) Quitar la política que exponía la base a anon; dejarla solo para authenticated.
--    Se dropea también la política nueva por si la migración ya corrió (idempotencia).
DROP POLICY IF EXISTS "Anyone reads therapist profiles" ON public.therapist_profiles;
DROP POLICY IF EXISTS "Authenticated reads therapist profiles" ON public.therapist_profiles;

CREATE POLICY "Authenticated reads therapist profiles"
  ON public.therapist_profiles FOR SELECT TO authenticated
  USING (true);

-- 2) Cortar el acceso anónimo directo a la tabla base (defensa en profundidad:
--    aunque no haya política anon, sin el grant tampoco hay superficie).
REVOKE SELECT ON TABLE public.therapist_profiles FROM anon;

-- 3) Vista pública curada: solo columnas seguras, solo perfiles activos y
--    verificados. Corre con los derechos del owner (security_invoker por
--    defecto = false), así que sirve la proyección sin exponer la base.
CREATE OR REPLACE VIEW public.public_therapist_directory AS
SELECT
  profile_id,
  professional_name,
  bio,
  specializations,
  languages,
  modalities,
  age_groups,
  accepts_online,
  accepts_in_person,
  years_experience,
  verified
FROM public.therapist_profiles
WHERE active = true
  AND verified = true;

-- 4) Solo lectura de la vista para público y autenticados.
REVOKE ALL ON public.public_therapist_directory FROM PUBLIC;
GRANT SELECT ON public.public_therapist_directory TO anon, authenticated;

COMMIT;

-- ============================================================================
-- REGLA 1 — el catálogo demuestra el estado final
-- ============================================================================
SELECT
  (SELECT roles::text FROM pg_policies WHERE schemaname='public' AND tablename='therapist_profiles' AND cmd='SELECT') AS tp_select_roles,
  (SELECT has_table_privilege('anon','public.therapist_profiles','SELECT'))       AS anon_base_select,
  (SELECT has_table_privilege('authenticated','public.therapist_profiles','SELECT')) AS auth_base_select,
  (SELECT EXISTS(SELECT 1 FROM information_schema.views WHERE table_schema='public' AND table_name='public_therapist_directory')) AS vista_existe,
  (SELECT has_table_privilege('anon','public.public_therapist_directory','SELECT')) AS anon_vista_select,
  (SELECT string_agg(column_name, ',' ORDER BY ordinal_position) FROM information_schema.columns WHERE table_schema='public' AND table_name='public_therapist_directory') AS vista_columnas,
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='v') AS vistas,
  (SELECT count(*) FROM pg_policies WHERE schemaname='public') AS politicas_total;
