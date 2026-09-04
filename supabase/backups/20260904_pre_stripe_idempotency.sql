-- ============================================================================
-- BACKUP / ROLLBACK previo a 20260904_stripe_idempotency.sql.
--
-- Antes de esta migración la tabla no existía (baseline: 44 tablas públicas).
-- El rollback la elimina. Es una tabla de solo-registro (event.id procesados),
-- sin datos de negocio: borrarla no afecta pagos ni cuentas.
-- ============================================================================

BEGIN;

DROP TABLE IF EXISTS public.stripe_processed_events;

COMMIT;

SELECT
  (SELECT count(*) FROM pg_tables WHERE schemaname='public') AS tablas;
