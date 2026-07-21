-- ============================================================================
-- Creacion automatica de perfil al registrarse un usuario en Auth.
--
-- Cierra el "hueco de Google": quien entra con un proveedor externo no pasa por
-- la Edge Function public-signup, asi que hasta ahora llegaba sin fila en
-- profiles (sin rol, sin plan) y useAuth lo dejaba en un limbo.
--
-- El trigger vive en auth.users porque es el unico punto por el que pasan TODOS
-- los altas: OAuth, invitacion, alta desde el panel de Supabase y la propia
-- public-signup.
--
-- NOTA SOBRE CONSENTIMIENTO: un alta por OAuth no otorga la autorizacion de
-- tratamiento de datos, asi que terms_accepted_at queda NULL a proposito. Estos
-- perfiles son identificables con `signup_source = 'oauth'` para pedirles la
-- aceptacion en su primer ingreso. NO se les marca marketing_consent.
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    role,
    plan_type,
    subscription_status,
    full_name,
    signup_source,
    onboarding_completed
  )
  VALUES (
    NEW.id,
    NEW.email,
    'patient',
    'free',
    'inactive',
    -- Google entrega el nombre en full_name; otros proveedores usan name.
    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      split_part(COALESCE(NEW.email, ''), '@', 1)
    ),
    'oauth',
    -- false: la anamnesis sigue siendo el siguiente paso de su onboarding.
    false
  )
  -- public-signup crea el perfil por su cuenta justo despues del createUser.
  -- Sin esto, esa ruta chocaria contra la PK. El que ya existe manda: no se
  -- pisan sus datos (plan, consentimiento, telefono) con los valores por defecto.
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_auth_user();

COMMENT ON FUNCTION handle_new_auth_user IS
  'Crea el perfil de cualquier usuario nuevo de Auth. Los altas por OAuth quedan con signup_source = oauth y terms_accepted_at NULL: falta pedirles la autorizacion de tratamiento de datos.';
