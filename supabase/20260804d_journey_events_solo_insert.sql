-- ============================================================================
-- journey_events: solo INSERT. Se cierra el TRUNCATE.
--
-- ── El riesgo ───────────────────────────────────────────────────────────────
--
-- La tabla es append-only y un trigger BEFORE lo garantiza… para UPDATE y
-- DELETE. **Los triggers no se disparan con TRUNCATE**, así que el modelo
-- append-only tenía un agujero del tamaño de la tabla entera: cualquiera con
-- privilegio TRUNCATE podía vaciarla de una sentencia, sin que el trigger se
-- enterara.
--
-- No es teórico. Al reproducirlo en este mismo sprint, un TRUNCATE ejecutado
-- como `authenticated` borró las 358 filas que había.
--
-- ── Por qué también `anon` ──────────────────────────────────────────────────
--
-- `anon` tenía exactamente los mismos privilegios que `authenticated`, y su
-- clave viaja en el paquete JavaScript que se descarga en cada visita. Dejarlo
-- abierto habría significado que el riesgo documentado no desaparece: solo deja
-- de necesitar cuenta. Se cierra en los dos roles.
--
-- ── Lo que NO se toca ───────────────────────────────────────────────────────
--
-- INSERT se mantiene en ambos roles: es el uso legítimo y el único que hace
-- `trackEvent()`. SELECT sigue sin concederse a nadie. Los triggers, la RLS y
-- las políticas quedan igual.
-- ============================================================================

REVOKE DELETE, UPDATE, TRUNCATE ON public.journey_events FROM authenticated;
REVOKE DELETE, UPDATE, TRUNCATE ON public.journey_events FROM anon;
