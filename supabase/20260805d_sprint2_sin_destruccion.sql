-- ============================================================================
-- SPRINT 2 — Quitar las operaciones destructivas que nadie usa.
--
-- Alcance estricto: solo se revocan DELETE y TRUNCATE a `authenticated`.
--
--   NO se tocan SELECT, INSERT ni UPDATE: sostienen el funcionamiento actual
--   hasta la migración a RPC de los sprints 4 y 5.
--   NO se activa RLS. NO se tocan políticas. NO se toca React.
--
-- ── Paso 1: el inventario de uso, antes de revocar ──────────────────────────
--
-- 1. En React/TypeScript: `grep -rn '\.delete()' src` devuelve UNA sola
--    coincidencia en todo el proyecto, `therapist_time_blocks`, que no está
--    aquí. Sobre las siete tablas clínicas: cero.
--
-- 2. En PostgreSQL: ninguna función del esquema `public` contiene
--    `DELETE FROM` sobre ninguna de ellas. Comprobado con una consulta sobre
--    `pg_get_functiondef` de todas las funciones, no leyendo migraciones.
--
-- 3. Lo que sí hacen esas tablas: insert, select, update y upsert. Ninguna
--    borra.
--
-- ── Por qué `profiles` entra, aunque no estuviera en la lista de siete ──────
--
-- Porque sin ella este sprint no elimina la destrucción, solo la desvía.
--
-- `profiles` tiene 45 claves foráneas apuntándole y casi todas son
-- ON DELETE CASCADE: `clinical_notes`, `psychometric_evaluations`,
-- `patient_anamnesis`, `clinical_consents`, `clinical_alerts`, `mood_entries`,
-- `patient_prescriptions`, `therapy_sessions`, `messages`… El borrado en
-- cascada lo ejecuta el sistema de integridad referencial y NO comprueba el
-- privilegio del usuario sobre las tablas hijas. Cerrar las siete y dejar
-- `profiles` abierta deja el camino intacto.
--
-- Demostrado con `SET LOCAL ROLE authenticated`, identidad de un usuario
-- CUALQUIERA —ni siquiera el dueño del perfil— y doble rollback:
--
--     perfil sin terapeuta, con 1 evaluacion
--     un usuario CUALQUIERA borra ese perfil: EJECUTADO -> quedan 0 evaluaciones
--
-- Un primer intento sobre un paciente CON terapeuta asignado sí falló, pero por
-- `RELATIONSHIP_APPEND_ONLY` — un trigger de `patient_therapist` que salta
-- durante la cascada. Es una protección accidental, de otra tabla y por otro
-- motivo, y solo cubre a quien ya tiene profesional. Un paciente recién
-- registrado que ha hecho un test y aún no ha sido asignado NO está cubierto, y
-- ese es el estado normal del embudo de entrada: hoy, 3 de 8 perfiles.
--
-- ── Qué NO se rompe ────────────────────────────────────────────────────────
--
-- Borrar una cuenta de verdad —derecho de supresión de la Ley 1581— sigue
-- siendo posible: lo hace `service_role` desde el panel o la API de
-- administración de Supabase, que conserva todos sus privilegios. Lo que deja de
-- poder hacerlo es el navegador de cualquier usuario registrado.
--
-- ── Reversión ───────────────────────────────────────────────────────────────
--
-- Al final del archivo, comentada.
-- ============================================================================

REVOKE DELETE, TRUNCATE ON public.clinical_notes           FROM authenticated;
REVOKE DELETE, TRUNCATE ON public.psychometric_evaluations FROM authenticated;
REVOKE DELETE, TRUNCATE ON public.patient_anamnesis        FROM authenticated;
REVOKE DELETE, TRUNCATE ON public.clinical_consents        FROM authenticated;
REVOKE DELETE, TRUNCATE ON public.clinical_alerts          FROM authenticated;
REVOKE DELETE, TRUNCATE ON public.mood_entries             FROM authenticated;
REVOKE DELETE, TRUNCATE ON public.patient_prescriptions    FROM authenticated;

-- La raíz de la cascada.
REVOKE DELETE, TRUNCATE ON public.profiles                 FROM authenticated;

-- ── Reversión ───────────────────────────────────────────────────────────────
--
-- GRANT DELETE, TRUNCATE
--   ON public.clinical_notes, public.psychometric_evaluations,
--      public.patient_anamnesis, public.clinical_consents, public.clinical_alerts,
--      public.mood_entries, public.patient_prescriptions, public.profiles
--   TO authenticated;
