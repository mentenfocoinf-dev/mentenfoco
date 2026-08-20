-- ============================================================================
-- Cierre de permisos directos.
--
-- Se ejecuta DESPUÉS de migrar todos los consumidores a las funciones seguras
-- de 20260803l. Antes de esto, cada REVOKE habría roto una pantalla.
-- ============================================================================

-- ── Cierre de permisos ──────────────────────────────────────────────────────
--
-- `anon` pierde todo sobre las tres. Un visitante sin sesión no tiene ninguna
-- razón legítima para tocarlas, y hasta hoy podía leerlas enteras.
REVOKE ALL ON public.messages           FROM anon;
REVOKE ALL ON public.patient_therapist  FROM anon;
REVOKE ALL ON public.therapy_sessions   FROM anon;

-- `patient_therapist`: lectura solo por función. Se mantiene UPDATE porque el
-- cierre de una relación va por ahí y su trigger ya decide quién puede.
REVOKE SELECT, INSERT, DELETE, TRUNCATE ON public.patient_therapist FROM authenticated;

-- `therapy_sessions`: lectura solo por función. INSERT y UPDATE siguen abiertos
-- porque el trigger de propiedad recién creado ya los controla, y porque el
-- panel del profesional agenda y edita sesiones directamente.
REVOKE SELECT, DELETE, TRUNCATE ON public.therapy_sessions FROM authenticated;

-- `messages`: SELECT permanece abierto para `authenticated` — y SOLO por eso:
-- las cuatro suscripciones de Realtime lo necesitan. Ver la cabecera.
REVOKE DELETE, TRUNCATE ON public.messages FROM authenticated;
