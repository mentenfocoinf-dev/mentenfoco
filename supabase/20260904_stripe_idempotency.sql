-- ============================================================================
-- Idempotencia del webhook de Stripe.
--
-- Stripe garantiza entrega "al menos una vez", no "exactamente una vez": un
-- reintento de red puede entregar el mismo evento dos veces. Esta tabla registra
-- los event.id ya procesados; el webhook inserta el id ANTES de aplicar efectos
-- y, si ya existía, sale con 200 OK (no-op) — nunca con error, que Stripe
-- interpretaría como "reintenta más".
--
-- Solo la escribe/lee el webhook (service_role, que hace BYPASS de RLS). Sin
-- políticas para anon/authenticated → sin acceso; además se revocan los grants
-- por nombre (defensa en profundidad; ver memoria del proyecto).
--
-- Backup/rollback: supabase/backups/20260904_pre_stripe_idempotency.sql
-- Idempotente: CREATE TABLE IF NOT EXISTS.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.stripe_processed_events (
  event_id     text PRIMARY KEY,
  processed_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.stripe_processed_events IS
  'Idempotencia del webhook de Stripe: event.id ya procesados (entrega al menos una vez).';

ALTER TABLE public.stripe_processed_events ENABLE ROW LEVEL SECURITY;

-- Sin acceso para roles no privilegiados (service_role hace bypass de RLS).
REVOKE ALL ON public.stripe_processed_events FROM anon, authenticated;

COMMIT;

-- Verificación
SELECT
  (SELECT count(*) FROM pg_tables
     WHERE schemaname='public' AND tablename='stripe_processed_events') AS tabla,
  (SELECT relrowsecurity FROM pg_class
     WHERE oid='public.stripe_processed_events'::regclass) AS rls_on,
  (SELECT count(*) FROM information_schema.role_table_grants
     WHERE table_schema='public' AND table_name='stripe_processed_events'
       AND grantee IN ('anon','authenticated')) AS grants_no_privilegiados;
