-- ============================================================================
-- R3 (parte backend) — rate-limit de public-signup.
--
-- EL PROBLEMA, demostrado en el diagnóstico R3/R6 (20-ago): la Edge Function
-- public-signup es pública (--no-verify-jwt) y sus únicas validaciones son
-- formato de email, longitud de nombre y terms_accepted. Un anónimo puede
-- POSTear sin tope: cada request crea un usuario Auth + fila en profiles + un
-- correo Resend. No hay rate-limit ni captcha. Impacto: abuso automatizable,
-- coste de Resend y daño a la reputación del dominio de envío.
--
-- ESTA MIGRACIÓN cubre la mitad backend del rate-limit (la otra mitad —
-- Turnstile— vive en el Edge Function y en SignupModal.tsx). Crea:
--
--   1) public.signup_rate_limit(ip_hash, window_start, count)
--      Contadores por IP (hasheada) y ventana horaria. RLS activo SIN políticas:
--      anon/authenticated no pueden leer ni escribir (las IPs son dato sensible);
--      solo service_role (que salta RLS) y el owner postgres operan la tabla.
--
--   2) public.enforce_signup_rate_limit(p_ip_hash text)
--      SECURITY DEFINER, atómica: incrementa el bucket de la hora actual y
--      devuelve si el intento está permitido bajo los límites 5/hora y 20/día.
--      El Edge Function la invoca por RPC como service_role ANTES de crear la
--      cuenta; si allowed=false responde 429 sin crear nada.
--
-- LÍMITES (aprobados): 5 intentos por IP por hora, 20 por IP por día.
--
-- Backup / rollback: supabase/backups/20260820_pre_signup_rate_limit.sql
--   (la reversión es DROP de ambos objetos: son nuevos, no modifican nada).
--
-- Idempotente: CREATE TABLE IF NOT EXISTS + CREATE OR REPLACE FUNCTION.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.signup_rate_limit (
  ip_hash      text        NOT NULL,
  window_start timestamptz NOT NULL,
  count        integer     NOT NULL DEFAULT 0,
  PRIMARY KEY (ip_hash, window_start)
);

-- RLS activo sin políticas => deny-all para anon/authenticated. service_role y
-- postgres (owner) saltan RLS. Las IPs hasheadas no deben ser legibles por el
-- cliente.
ALTER TABLE public.signup_rate_limit ENABLE ROW LEVEL SECURITY;

-- Endurecimiento de ACL: ningún grant a los roles de cliente.
REVOKE ALL ON TABLE public.signup_rate_limit FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.enforce_signup_rate_limit(p_ip_hash text)
 RETURNS TABLE(allowed boolean, hourly integer, daily integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  w timestamptz := date_trunc('hour', now());
  h integer;
  d integer;
BEGIN
  -- Poda oportunista: los buckets de más de 48h ya no cuentan para ninguna
  -- ventana (la más larga es 24h). Mantiene la tabla acotada sin un cron.
  DELETE FROM public.signup_rate_limit
    WHERE window_start < now() - interval '48 hours';

  -- Incremento atómico del bucket de la hora actual.
  INSERT INTO public.signup_rate_limit AS srl (ip_hash, window_start, count)
    VALUES (p_ip_hash, w, 1)
    ON CONFLICT (ip_hash, window_start)
    DO UPDATE SET count = srl.count + 1
    RETURNING srl.count INTO h;

  -- Suma de las últimas 24h para el límite diario.
  SELECT COALESCE(sum(srl.count), 0)::integer INTO d
    FROM public.signup_rate_limit srl
    WHERE srl.ip_hash = p_ip_hash
      AND srl.window_start >= now() - interval '24 hours';

  -- Permitido mientras no se supere ninguno de los dos límites. El intento
  -- actual ya está contado (h y d lo incluyen): el 5.º de la hora pasa, el 6.º
  -- se bloquea; el 20.º del día pasa, el 21.º se bloquea.
  RETURN QUERY SELECT (h <= 5 AND d <= 20), h, d;
END
$function$;

-- Solo service_role (y el owner) ejecutan la función; nadie más la necesita.
-- OJO: ALTER DEFAULT PRIVILEGES (de postgres/supabase_admin) concede EXECUTE en
-- toda función nueva a los roles NOMBRADOS anon/authenticated/service_role. Un
-- REVOKE ... FROM PUBLIC NO los quita (el grant no es a PUBLIC). Hay que revocar
-- de anon y authenticated por nombre.
REVOKE ALL ON FUNCTION public.enforce_signup_rate_limit(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_signup_rate_limit(text) TO service_role;

COMMIT;

-- ============================================================================
-- REGLA 1 — el catálogo demuestra el estado final
-- ============================================================================
SELECT
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.signup_rate_limit'::regclass)  AS rls_activo,
  (SELECT relforcerowsecurity FROM pg_class WHERE oid = 'public.signup_rate_limit'::regclass) AS force_rls,
  (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='signup_rate_limit') AS politicas_tabla,
  (SELECT coalesce(array_to_string(relacl, ', '), '(sin ACL: dueño only)') FROM pg_class
     WHERE oid = 'public.signup_rate_limit'::regclass)                                     AS acl_literal,
  (SELECT has_function_privilege('service_role', 'public.enforce_signup_rate_limit(text)', 'EXECUTE')) AS service_role_execute,
  (SELECT has_function_privilege('anon', 'public.enforce_signup_rate_limit(text)', 'EXECUTE'))         AS anon_execute,
  (SELECT prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname='enforce_signup_rate_limit')                   AS security_definer,
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relkind='r')                                           AS tablas_base,
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity)                      AS tablas_con_rls,
  (SELECT count(*) FROM pg_policies WHERE schemaname='public')                             AS politicas_total;
