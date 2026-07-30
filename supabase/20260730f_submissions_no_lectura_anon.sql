-- ============================================================================
-- Los correos de los envios no se leen desde la ruta publica.
--
-- Detectado probando la API real: con RLS apagado, la anon key podia hacer
-- SELECT sobre public_test_submissions y sacar los correos de todo el mundo.
-- La spec pide "SELECT solo admin" y esa policy esta escrita, pero comentada
-- como el resto del proyecto — o sea, hoy no protege nada.
--
-- A diferencia de otros huecos que se difieren a la fase de seguridad, este es
-- una fuga de datos de contacto de terceros en una tabla que cuelga de una ruta
-- SIN LOGIN. No puede esperar.
--
-- Se cierra con GRANT/REVOKE, que son permisos de tabla de Postgres y NO son
-- RLS: no se activa row level security en ninguna tabla, no cambia el
-- comportamiento del resto del proyecto y la policy comentada sigue siendo la
-- solucion definitiva para la fase final.
--
-- `anon` conserva:
--   INSERT          -> registrar que se hizo el test (el flujo publico).
--   SELECT (id)     -> PostgREST necesita leer la columna devuelta por
--                      `insert(...).select("id")` y para filtrar `?id=eq.X`.
--   UPDATE (email)  -> anadir el correo despues, al envio que acaba de crear.
-- Y pierde la lectura de email, score, banda y test_slug de cualquier fila.
--
-- `authenticated` se deja como esta: ahi el filtrado por rol admin es cosa de la
-- policy, y quitarselo ahora romperia el panel de leads cuando se construya.
-- ============================================================================

REVOKE SELECT ON public_test_submissions FROM anon;

GRANT SELECT (id) ON public_test_submissions TO anon;
GRANT INSERT ON public_test_submissions TO anon;
GRANT UPDATE (email) ON public_test_submissions TO anon;
