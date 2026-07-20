-- ============================================================================
-- Signup autoservicio de cuenta gratuita (captura de leads + email marketing).
--
-- La cuenta gratuita NO da acceso al producto real: sin terapeuta asignado, sin
-- sesiones, sin mensajeria. Solo ve un subconjunto curado de guias como gancho.
--
-- NOTA SOBRE RLS: en este proyecto RLS esta desactivado en todas las tablas
-- (decision explicita: la fase de seguridad va al final). Por eso el filtrado de
-- guias de la cuenta gratuita se hace en la capa de servicio (guidesService.ts),
-- y la policy equivalente queda escrita pero COMENTADA al final de este archivo
-- para aplicarse en la fase de seguridad -- mismo patron usado en
-- 20260717_create_messages.sql.
-- ============================================================================

-- Columnas nuevas en profiles para soportar el signup autoservicio.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_version text,
  ADD COLUMN IF NOT EXISTS marketing_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS signup_source text;

COMMENT ON COLUMN profiles.must_change_password IS
  'true tras signup autoservicio: fuerza pantalla de "crea tu contrasena" en el primer login.';
COMMENT ON COLUMN profiles.terms_accepted_at IS
  'Timestamp de aceptacion de terminos/tratamiento de datos (Ley 1581 de 2012). No debe ser null para cuentas creadas por signup-gratis.';
COMMENT ON COLUMN profiles.marketing_consent IS
  'Consentimiento explicito y separado para comunicaciones comerciales. Opcional: su ausencia no impide crear la cuenta.';

-- Curaduria de guias visibles para cuentas plan_type = 'free' creadas por signup.
-- Los planes de pago siguen viendo todo el catalogo segun min_plan, sin cambios.
ALTER TABLE clinical_guides
  ADD COLUMN IF NOT EXISTS visible_en_plan_gratis boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN clinical_guides.visible_en_plan_gratis IS
  'Vitrina de la cuenta gratuita de captura de leads. Solo restringe a plan_type = free; no afecta a los planes de pago.';

-- Vitrina: una guia por categoria para dar variedad al lead.
UPDATE clinical_guides SET visible_en_plan_gratis = true
WHERE id IN (
  'ansiedad-estres',          -- Manejo del estres laboral
  'autoestima-autoconcepto',  -- Mejorar tu autoconcepto
  'relaciones-comunicacion',  -- Comunicacion asertiva en pareja
  'infantil-regulacion'       -- Regulacion emocional infantil
);

-- La vista de metadatos tiene lista explicita de columnas (no SELECT *), asi que
-- hay que recrearla para exponer visible_en_plan_gratis al cliente. CREATE OR
-- REPLACE permite anadir columnas al final conservando el orden existente.
CREATE OR REPLACE VIEW clinical_guides_meta AS
  SELECT id,
    categoria,
    etiquetas,
    titulo,
    "descripcionBreve",
    "tiempoLectura",
    "imageName",
    es_premium,
    min_plan,
    visible_en_plan_gratis
  FROM clinical_guides;

-- ============================================================================
-- FASE DE SEGURIDAD (no aplicar todavia -- RLS esta desactivado a proposito).
-- Cuando se active RLS sobre clinical_guides, esta policy reemplaza a
-- "Guides readable by plan level" para que la cuenta gratuita de captura de
-- leads vea solo la vitrina, sin tocar el acceso de los planes de pago.
--
-- DROP POLICY IF EXISTS "Guides readable by plan level" ON clinical_guides;
-- CREATE POLICY "Guides readable by plan level" ON clinical_guides
--   FOR SELECT USING (
--     get_my_role() = ANY (ARRAY['admin'::user_role, 'therapist'::user_role])
--     OR (
--       CASE
--         WHEN (SELECT plan_type FROM profiles WHERE id = auth.uid()) = 'free'
--           THEN visible_en_plan_gratis = true
--         ELSE plan_rank(min_plan) = 0 OR get_my_plan_rank() >= plan_rank(min_plan)
--       END
--     )
--   );
-- ============================================================================
