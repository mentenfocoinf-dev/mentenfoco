-- ============================================================================
-- SPRINT 3 — Endurecer `profiles`.
--
-- Objetivo: que nadie pueda cambiar `role`, `session_token` ni los campos
-- administrativos, y que cada persona solo pueda editar lo suyo.
--
--   NO se activa RLS. NO se tocan las 5 políticas inertes.
--   NO se revoca SELECT: las lecturas pasan a RPC en sprints posteriores.
--
-- ── Estado de partida, medido (no deducido) ─────────────────────────────────
--
-- `authenticated` tenía UPDATE sobre las 21 columnas y `profiles` NO tenía
-- ningún trigger. Ejecutado con `SET LOCAL ROLE authenticated` y rollback:
--
--     propio ROLE -> admin: PUEDE (escalada)
--     propio SESSION_TOKEN: PUEDE
--     propio PLAN -> premium: PUEDE
--     propio EMAIL: PUEDE
--     propio stripe_customer_id: PUEDE
--     AJENO full_name: PUEDE
--     DEGRADAR AL ADMIN: PUEDE
--     AJENO session_token: PUEDE (secuestro)
--
-- Lo único que ya estaba cerrado: `anon` (sprint 1) y crear un perfil falso,
-- que choca contra `profiles_id_fkey` hacia `auth.users`.
--
-- ── Dos capas, por motivos distintos ────────────────────────────────────────
--
-- 1. GRANT por columna — decide QUÉ columnas son escribibles. Es el mecanismo
--    más fuerte: actúa antes que cualquier trigger y no depende de que la
--    lógica sea correcta.
--
-- 2. Trigger de propiedad — decide DE QUIÉN. Un grant por columna no distingue
--    entre editar tu nombre y editar el de otro; eso solo se sabe mirando la
--    fila.
--
-- Ninguna de las dos sustituye a la otra.
--
-- ── Qué columnas quedan escribibles, y por qué esas ─────────────────────────
--
-- Se han inventariado TODAS las escrituras del frontend, una por una:
--
--   useAuth.tsx:100          session_token                  -> pasa a RPC
--   adminService:69          subscription_status,updated_at -> pasa a RPC
--   anamnesis.tsx:190        full_name, onboarding_completed
--   completar-perfil.tsx:88  cedula, phone, emergency_contact_name,
--                            emergency_contact_phone
--   consentimiento.tsx:44    terms_accepted_at, terms_version, marketing_consent
--   nueva-contrasena.tsx:68  must_change_password
--
-- Se concede exactamente ese conjunto, más `avatar_url` —que hoy nadie escribe
-- pero es dato personal del propio usuario y la Fase 6 lo pide— y `updated_at`.
--
-- Quedan FUERA: `id`, `role`, `session_token`, `plan_type`,
-- `subscription_status`, `email`, `stripe_customer_id`, `signup_source`,
-- `created_at`.
--
-- Nota sobre `email`: se cierra aquí, pero la fuente de verdad del correo es
-- `auth.users`, no esta tabla — `useAuth` sobrescribe el campo con el de la
-- sesión al leer el perfil. Cerrarlo no quita ninguna capacidad real.
--
-- ── Lo que las funciones SECURITY DEFINER siguen pudiendo hacer ─────────────
--
-- `admin_set_plan`, `handle_new_user` y `handle_new_auth_user` se ejecutan como
-- `postgres`, así que los GRANT por columna no las afectan. Siguen funcionando
-- igual. El trigger sí las mira, y por eso contempla el caso de sistema.
--
-- ── Reversión ───────────────────────────────────────────────────────────────
--
-- `supabase/backups/20260805_pre_sprint3_profiles.sql`. Un solo archivo.
-- ============================================================================

-- ── 1. Permisos por columna ─────────────────────────────────────────────────
REVOKE UPDATE ON public.profiles FROM authenticated;

GRANT UPDATE (
  full_name,
  phone,
  avatar_url,
  cedula,
  emergency_contact_name,
  emergency_contact_phone,
  marketing_consent,
  terms_accepted_at,
  terms_version,
  onboarding_completed,
  must_change_password,
  updated_at
) ON public.profiles TO authenticated;

-- ── 2. Trigger de propiedad ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_profile_ownership()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  quien uuid := auth.uid();
  rol   text := coalesce(current_setting('request.jwt.claims', true)::json->>'role', '');
  es_sistema boolean := (rol = 'service_role') OR (quien IS NULL AND rol = '');
  es_admin boolean;
BEGIN
  -- Alta de cuenta: `handle_new_user` inserta el perfil desde un trigger sobre
  -- `auth.users`. Llega anidado, y en ese momento todavía no hay sesión.
  IF es_sistema OR pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  SELECT p.role = 'admin' INTO es_admin FROM profiles p WHERE p.id = quien;
  IF coalesce(es_admin, false) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Sin esto, alguien podría crear el perfil de otra cuenta de `auth.users`
    -- que aún no lo tenga, y elegirle el rol.
    IF quien IS DISTINCT FROM NEW.id THEN
      RAISE EXCEPTION 'PROFILE_FORBIDDEN: no puedes crear el perfil de otra persona.';
    END IF;
    RETURN NEW;
  END IF;

  IF quien IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'PROFILE_FORBIDDEN: solo puedes editar tu propio perfil.';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'PROFILE_IMMUTABLE: el identificador no se cambia.';
  END IF;

  -- Redundante con los GRANT por columna, a propósito: si algún día alguien
  -- vuelve a conceder UPDATE sobre la tabla entera, esto sigue de pie.
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'PROFILE_ROLE_LOCKED: el rol no se cambia desde la aplicación.';
  END IF;
  IF NEW.plan_type IS DISTINCT FROM OLD.plan_type
     OR NEW.subscription_status IS DISTINCT FROM OLD.subscription_status THEN
    RAISE EXCEPTION 'PROFILE_BILLING_LOCKED: el plan lo gestiona la administración.';
  END IF;

  -- `session_token` NO se comprueba aquí. Quien lo escribe legítimamente es
  -- `claim_session_token()`, que corre con la identidad del propio usuario y por
  -- tanto llega a este punto igual que una escritura directa: una comprobación
  -- aquí bloquearía la vía que se acaba de crear para sustituirla.
  --
  -- La escritura directa la impide el GRANT por columna, que es el mecanismo
  -- fuerte y actúa antes que cualquier trigger. Verificado: un UPDATE directo
  -- sobre `session_token` como `authenticated` se deniega.
  --
  -- `role`, `plan_type` y `subscription_status` sí se comprueban porque no
  -- tienen ninguna vía legítima desde una sesión no administrativa: las
  -- funciones `admin_*` salen antes, por la rama de administrador.

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_profile_ownership ON public.profiles;
CREATE TRIGGER trg_profile_ownership
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_ownership();

-- ── 3. Las dos escrituras legítimas que pierden su columna ──────────────────
--
-- Sin estas dos funciones, cerrar las columnas rompería `useAuth` y el panel de
-- administración. Se mueven a RPC en vez de dejarles la columna abierta.

-- El propio usuario reclama el dispositivo. Solo el suyo, y solo el token.
CREATE OR REPLACE FUNCTION public.claim_session_token(p_token uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: necesitas iniciar sesión.';
  END IF;
  UPDATE profiles SET session_token = p_token, updated_at = now()
   WHERE id = auth.uid();
END
$$;

REVOKE ALL ON FUNCTION public.claim_session_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_session_token(uuid) TO authenticated;

-- Activar o desactivar una cuenta sin tocar su plan. Misma guardia que las
-- demás `admin_*` tras el sprint 0, incluido el caso NULL.
CREATE OR REPLACE FUNCTION public.admin_set_status(p_user uuid, p_status text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.get_my_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED: solo un administrador puede cambiar el estado de una cuenta.';
  END IF;
  IF p_status NOT IN ('active', 'inactive') THEN
    RAISE EXCEPTION 'INVALID_STATUS: estado no permitido.';
  END IF;
  UPDATE profiles SET subscription_status = p_status, updated_at = now()
   WHERE id = p_user;
END
$$;

REVOKE ALL ON FUNCTION public.admin_set_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_status(uuid, text) TO authenticated;
