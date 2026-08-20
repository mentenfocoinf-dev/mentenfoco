-- ============================================================================
-- `authenticated` pierde DELETE y TRUNCATE sobre el contenido público.
--
-- Alcance: UN solo tipo de cambio — revocar privilegios destructivos al rol
-- `authenticated` sobre 7 objetos. No se toca SELECT, INSERT ni UPDATE. No se
-- toca `anon`, ni RLS, ni políticas, ni funciones, ni triggers. Ni React.
--
-- ── El problema, demostrado antes de escribir esto ──────────────────────────
--
-- Con una sesión de PACIENTE —el rol menos privilegiado que existe—, ejecutado
-- con `SET LOCAL ROLE authenticated` y rollback forzado:
--
--     PACIENTE BORRA content_items: 26 filas
--     PACIENTE BORRA clinical_guides: 20 filas
--     PACIENTE BORRA cie11_directory: 163 filas
--     PACIENTE BORRA guides: 0 filas
--     PACIENTE BORRA content_items_meta: 26 filas   <- por la VISTA
--     PACIENTE BORRA clinical_guides_meta: 20 filas <- por la VISTA
--     paciente borra public_tests: denegado (FK public_test_submissions_test_slug_fkey)
--
-- 209 filas destruibles con una cuenta gratuita. `public_tests` se salva por
-- accidente: lo protege una clave foránea, no un permiso — si esa tabla
-- estuviera vacía de envíos, también caería.
--
-- Y hay daño en cascada que el recuento no muestra: `blog_comments` y
-- `content_revisions` referencian `content_items` con ON DELETE CASCADE, y
-- `user_guide_progress` referencia `guides` igual. Borrar el contenido se lleva
-- por delante los comentarios del blog y el progreso de lectura.
--
-- ── Las vistas también hay que revocarlas ───────────────────────────────────
--
-- `content_items_meta` y `clinical_guides_meta` son vistas actualizables, y el
-- DELETE a través de ellas funcionó: 26 y 20 filas. Revocar solo en la tabla
-- base NO habría bastado.
--
-- ── Por qué revocar no rompe nada ───────────────────────────────────────────
--
-- Inventario del estado actual, no de las migraciones:
--
-- FRONTEND
--   · `grep -rn '\.delete()' src` en todo el proyecto -> UNA coincidencia:
--     `timeBlocksService.ts:89`, sobre `therapist_time_blocks`. Fuera de alcance.
--   · `.remove(` (borrado de Storage) -> cero coincidencias en todo `src`.
--   · Los 7 objetos, contando `delete` en las 8 líneas siguientes a cada
--     `.from()` -> 0, 0, 0, 0, 0, 0, 0.
--   · Las 30 funciones `.rpc()` que el frontend invoca: dos contienen borrado
--     (`admin_assign_patient`, `admin_unassign_patient`) y ambas borran de
--     `patient_therapist`, no de estos siete.
--
-- POSTGRESQL (catálogo vivo, todas las funciones y procedimientos del esquema)
--   · Con el patrón `(DELETE FROM|TRUNCATE) … (los 7)` -> CERO coincidencias.
--   · Única función que los menciona: `enforce_blog_comment_moderation`, que es
--     un trigger y no contiene borrado.
--   · Triggers `BEFORE DELETE` sobre los siete -> NINGUNO. Los tres triggers
--     existentes son `trg_content_items_updated_at`,
--     `trg_content_publish_is_admin` y `trg_no_public_risk_instrument`: ninguno
--     depende del privilegio ni protege contra él.
--
-- Archivar contenido es `status='archivado'`, un UPDATE. Por eso no hay ni un
-- solo borrado en el flujo editorial.
--
-- ── TRUNCATE solo en las tablas ────────────────────────────────────────────
--
-- Las dos vistas conservan el bit `D` en su ACL. No se revoca porque PostgreSQL
-- no permite truncar una vista en ningún caso: es un privilegio inaplicable, y
-- este sprint solo toca lo que tiene efecto. Queda anotado como riesgo residual
-- cosmético.
--
-- ── Idempotencia ───────────────────────────────────────────────────────────
--
-- `REVOKE` sobre un privilegio ya revocado no es error en PostgreSQL: no hace
-- nada y no avisa. Este archivo se puede ejecutar las veces que haga falta.
--
-- ── Reversión ──────────────────────────────────────────────────────────────
--
-- `supabase/backups/20260806_pre_auth_delete_contenido.sql`
-- ============================================================================

-- Las cinco TABLAS: DELETE y TRUNCATE.
REVOKE DELETE, TRUNCATE ON public.content_items   FROM authenticated;
REVOKE DELETE, TRUNCATE ON public.clinical_guides FROM authenticated;
REVOKE DELETE, TRUNCATE ON public.guides          FROM authenticated;
REVOKE DELETE, TRUNCATE ON public.cie11_directory FROM authenticated;
REVOKE DELETE, TRUNCATE ON public.public_tests    FROM authenticated;

-- Las dos VISTAS: solo DELETE, que es lo único ejecutable sobre una vista.
REVOKE DELETE ON public.content_items_meta   FROM authenticated;
REVOKE DELETE ON public.clinical_guides_meta FROM authenticated;
