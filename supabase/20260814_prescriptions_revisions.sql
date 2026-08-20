-- ============================================================================
-- Sprint Catálogo + Auditoría — clinical_prescriptions + content_revisions
--
-- DOS TABLAS, UN SPRINT, DOS MECANISMOS DISTINTOS. Comparten diagnóstico y ACL
-- —las dos son `authenticated=arwm`— pero no comparten solución.
--
-- CERO POLÍTICAS NUEVAS. La única que hace falta ya existe desde el 12 de agosto.
--
-- ────────────────────────────────────────────────────────────────────────────
-- LO QUE DE VERDAD CIERRA ESTE SPRINT ES EL REVOKE, NO RLS.
--
--   Conviene decirlo antes que nada, porque es fácil atribuírselo a RLS: en las
--   dos tablas el problema NUNCA fue la falta de row level security, sino que la
--   ACL concede escritura a `authenticated` desde el día que se crearon —2024 en
--   una, julio de 2026 en la otra—. Una política FILTRA los privilegios que ya
--   existen; no los quita. El REVOKE los quita.
--
--   RLS se activa aquí como SEGUNDA CAPA, no como la corrección.
--
-- ────────────────────────────────────────────────────────────────────────────
-- 1) clinical_prescriptions — catálogo de 14 plantillas de ejercicio terapéutico
--
--   Medido antes, con RLS apagado, sobre una plantilla real:
--
--     instrucción ACTUAL de "Activación Conductual Matutina":
--       "Mañana, independientemente de cómo te sientas, levántate a las 8:00 AM…"
--     un PACIENTE la reescribe ........... 1 fila MODIFICADA
--     instrucción AHORA:
--       "ZZ: deja de tomar tu medicacion y no vayas a la consulta."
--
--   Ese texto es exactamente lo que el paciente lee en su PatientDashboard como
--   la indicación de su terapeuta, y afecta a TODOS los pacientes con esa
--   plantilla asignada, no solo a quien la modificó.
--
--     ACL ......... authenticated tiene UPDATE sobre las 4 columnas   NO lo impide
--     RLS ......... apagado, y su única política es de SELECT         NO lo impide
--     trigger ..... no hay ninguno                                    NO lo impide
--     constraint .. 0 CHECK                                           NO lo impide
--     >>> NINGUNA CAPA
--
--   El SELECT SE CONSERVA, y no es opcional. Lo necesitan dos consumidores:
--     · clinicalService.ts:200  getPrescriptionsCatalog()   (terapeuta)
--     · clinicalService.ts:224  getPatientPrescriptions()   (paciente), que lee
--       el catálogo mediante el embed
--       `prescription:clinical_prescriptions (titulo, objetivo_clinico, …)`
--
--   PostgREST resuelve ese embed como UNA consulta con join sobre la tabla
--   embebida, ejecutada CON EL ROL DE QUIEN LLAMA. Por tanto RLS sobre el padre
--   SÍ alcanza al embed, y necesita SELECT a nivel de tabla. Medido en
--   simulación revertida, sembrando 1 asignación:
--
--     RLS apagado ............................... 1 fila con título e instrucción
--     RLS ACTIVO conservando la política ........ 1 fila con título e instrucción
--     RLS ACTIVO y SIN política ................. 0 filas  <<< y EN SILENCIO
--
--   El último caso importa: como el embed es un LEFT JOIN, una denegación NO da
--   error — devuelve el título a NULL. POR ESO LA POLÍTICA DEL GRUPO 0 NO SE
--   TOCA. Es la que sostiene el PatientDashboard.
--
-- ────────────────────────────────────────────────────────────────────────────
-- 2) content_revisions — auditoría editorial, vacía y sin consumidores
--
--   Creada en 20260724_content_items.sql con un propósito explícito:
--   «Guarda el cuerpo previo cuando un admin edita lo que envió un terapeuta,
--    PARA QUE EL AUTOR PUEDA VER QUÉ SE LE CAMBIÓ.»
--   Esa misma migración dejó comentado el modelo de RLS previsto
--   ("Revisions visible to author and admins").
--
--   El flujo NUNCA se construyó: 0 filas y CERO consumidores ejecutables en
--   src/, las 4 Edge Functions, scripts, cron, RPC y funciones SQL.
--   `enforce_content_authorization()` la menciona solo en un comentario; su
--   trigger está en `content_items`, no aquí. content_revisions tiene 0 triggers.
--
--   Medido antes, con RLS apagado:
--
--     paciente  INSERT con edited_by AJENO ... SE CREA   <<< a nombre del terapeuta
--     paciente  UPDATE de las revisiones ..... MODIFICA  <<< reescribe la auditoría
--     paciente  DELETE ...................... 42501 ACL
--     anon      INSERT ...................... 42501 ACL
--
--   Un registro de auditoría en el que cualquiera escribe a nombre de otro no es
--   un registro de auditoría. Se cierra ENTERA: nadie la lee, así que tampoco
--   hace falta conservarle el SELECT.
--
--   LA TABLA SE CONSERVA. No se elimina, por decisión explícita: a diferencia de
--   `guides` y `test_scores`, tiene una promesa de producto documentada y un
--   modelo de RLS ya redactado. Este sprint NO implementa la auditoría ni crea
--   ninguna capacidad nueva: solo deja la tabla cerrada y lista.
--
--   SOBRE SU RLS, CON FRANQUEZA: revocado todo, RLS aquí no tiene nada que
--   filtrar. Se activa por homogeneidad con el resto del esquema y para dejar el
--   acceso explícitamente cerrado, no porque añada protección que el REVOKE no
--   dé ya. Está aprobado sabiéndolo.
--
-- ────────────────────────────────────────────────────────────────────────────
-- QUÉ NO TOCA:
-- la política existente del Grupo 0 (ni se borra ni se modifica), el SELECT de
-- `authenticated` sobre clinical_prescriptions, los privilegios de `postgres` y
-- `service_role`, el `anon` de clinical_prescriptions, propietarios, columnas,
-- defaults, CHECK, FK —incluida la entrante desde patient_prescriptions—,
-- índices, triggers (0 en ambas), funciones, vistas (0), Realtime (0), datos,
-- frontend, RPC, ni ninguna otra tabla. FORCE no se activa.
--
-- ESTADO FINAL: RLS 29 -> 31 de 37. POLÍTICAS: 92, SIN CAMBIO.
--   (El plan preveía 93; es un error de conteo: la política de
--    clinical_prescriptions ya estaba dentro de las 92 y aquí no se crea ninguna.)
--
-- Backup: supabase/backups/20260814_pre_prescriptions_revisions.sql
-- Diagnóstico: contexto-proyecto/auditorias-tecnicas/Diagnostico_RLS_prescriptions_revisions_2026-08-14.md
--
-- Idempotente: REVOKE sobre lo ya revocado no falla; ENABLE RLS sobre lo ya
-- activo tampoco. Ninguna sentencia crea ni elimina políticas.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. clinical_prescriptions: se cierra la escritura, se conserva la lectura.
--
--    Solo INSERT y UPDATE. NO se revoca SELECT —lo necesitan el catálogo del
--    terapeuta y el embed del paciente— ni MAINTAIN, que no abre nada.
--    `anon` no se toca: ya estaba en `-------m`.
-- ----------------------------------------------------------------------------
REVOKE INSERT, UPDATE ON TABLE public.clinical_prescriptions FROM authenticated;

-- ----------------------------------------------------------------------------
-- 2. content_revisions: se cierra entera. Nadie la lee ni la escribe.
-- ----------------------------------------------------------------------------
REVOKE ALL PRIVILEGES ON TABLE public.content_revisions FROM anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. RLS como segunda capa. Cero políticas nuevas en ambas.
--
--    clinical_prescriptions conserva "Authenticated users read the prescription
--    catalog" (SELECT · TO authenticated · USING (true)), que ni se elimina ni
--    se modifica: sin ella el embed devolvería 0 filas en silencio.
--
--    content_revisions queda con RLS y 0 políticas: cerrada por completo para
--    los roles de cliente, que además ya no tienen ningún privilegio.
-- ----------------------------------------------------------------------------
ALTER TABLE public.clinical_prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_revisions      ENABLE ROW LEVEL SECURITY;

COMMIT;

-- ============================================================================
-- REGLA 1 — el catálogo demuestra el estado final
-- ============================================================================
SELECT
  (SELECT relrowsecurity FROM pg_class
     WHERE oid = 'public.clinical_prescriptions'::regclass)             AS cp_rls,
  (SELECT relforcerowsecurity FROM pg_class
     WHERE oid = 'public.clinical_prescriptions'::regclass)             AS cp_force,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'clinical_prescriptions') AS cp_politicas,
  (SELECT policyname || ' [' || cmd || '] ' || array_to_string(roles, ',')
     FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'clinical_prescriptions') AS cp_politica,
  (SELECT CASE WHEN has_table_privilege('authenticated','public.clinical_prescriptions','SELECT')     THEN 'r' ELSE '-' END
       || CASE WHEN has_table_privilege('authenticated','public.clinical_prescriptions','INSERT')     THEN 'a' ELSE '-' END
       || CASE WHEN has_table_privilege('authenticated','public.clinical_prescriptions','UPDATE')     THEN 'w' ELSE '-' END
       || CASE WHEN has_table_privilege('authenticated','public.clinical_prescriptions','DELETE')     THEN 'd' ELSE '-' END
       || CASE WHEN has_table_privilege('authenticated','public.clinical_prescriptions','TRUNCATE')   THEN 'D' ELSE '-' END
       || CASE WHEN has_table_privilege('authenticated','public.clinical_prescriptions','REFERENCES') THEN 'x' ELSE '-' END
       || CASE WHEN has_table_privilege('authenticated','public.clinical_prescriptions','TRIGGER')    THEN 't' ELSE '-' END
       || CASE WHEN has_table_privilege('authenticated','public.clinical_prescriptions','MAINTAIN')   THEN 'm' ELSE '-' END) AS cp_auth,
  (SELECT count(*) FROM public.clinical_prescriptions)                  AS cp_filas,
  (SELECT md5(string_agg(id::text, '|' ORDER BY id))
     FROM public.clinical_prescriptions)                                AS cp_huella,
  (SELECT relrowsecurity FROM pg_class
     WHERE oid = 'public.content_revisions'::regclass)                  AS cr_rls,
  (SELECT relforcerowsecurity FROM pg_class
     WHERE oid = 'public.content_revisions'::regclass)                  AS cr_force,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'content_revisions')   AS cr_politicas,
  (SELECT CASE WHEN has_table_privilege('authenticated','public.content_revisions','SELECT')   THEN 'r' ELSE '-' END
       || CASE WHEN has_table_privilege('authenticated','public.content_revisions','INSERT')   THEN 'a' ELSE '-' END
       || CASE WHEN has_table_privilege('authenticated','public.content_revisions','UPDATE')   THEN 'w' ELSE '-' END
       || CASE WHEN has_table_privilege('authenticated','public.content_revisions','MAINTAIN') THEN 'm' ELSE '-' END) AS cr_auth,
  (SELECT CASE WHEN has_table_privilege('anon','public.content_revisions','MAINTAIN') THEN 'm' ELSE '-' END) AS cr_anon,
  (SELECT count(*) FROM public.content_revisions)                       AS cr_filas,
  (SELECT count(*) FROM information_schema.column_privileges
    WHERE table_schema = 'public'
      AND table_name IN ('clinical_prescriptions', 'content_revisions')
      AND grantee IN ('anon', 'authenticated'))                         AS grants_columna,
  (SELECT count(*) FROM pg_trigger
     WHERE tgrelid IN ('public.clinical_prescriptions'::regclass,
                       'public.content_revisions'::regclass)
       AND NOT tgisinternal)                                            AS triggers,
  (SELECT count(*) FROM pg_constraint
     WHERE confrelid = 'public.clinical_prescriptions'::regclass
       AND contype = 'f')                                               AS cp_fk_entrantes,
  (SELECT count(*) FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity) AS tablas_con_rls,
  (SELECT count(*) FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND c.relforcerowsecurity)                                        AS tablas_con_force,
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'public')        AS politicas_public;
