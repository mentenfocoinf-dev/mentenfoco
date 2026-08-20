-- ============================================================================
-- Cierre del acceso anónimo a 11 tablas clínicas y de contacto.
--
-- Alcance: la ACL del rol `anon`. Nada más. No se tocan datos, ni RLS, ni
-- políticas, ni triggers, ni funciones, ni columnas, ni React, ni Edge
-- Functions, ni scripts, ni `authenticated`, ni `service_role`, ni `postgres`,
-- ni `content_items` ni el módulo editorial.
--
-- ── Por qué, y con qué autoridad ────────────────────────────────────────────
--
-- ADR-013 fija el criterio: *"cuando el hueco expone datos de terceros o
-- permite fabricar evidencia, se cierra en el momento"*, y precisa que se
-- cierra *"con los mecanismos disponibles sin romper el diferimiento general
-- —reglas de la base y permisos de tabla— no activando la capa que está
-- deliberadamente apagada"*. Eso es exactamente lo que hace esta migración:
-- permisos de tabla, sin tocar RLS.
--
-- ── Qué había, medido ───────────────────────────────────────────────────────
--
-- Las once tenían `anon=arwdDxtm`: los ocho privilegios, sin ningún trigger
-- que los acotara. Demostrado ejecutando como `anon`, sin sesión:
--
--     clinical_tasks           !!! CREO 1 tarea a nombre de un terapeuta real
--                                  sobre un paciente real
--     family_genograms         !!! CREO 1
--     clinical_prescriptions   !!! REESCRIBIO la instruccion de 14 prescripciones
--     clinical_prescriptions   !!! BORRO 14 prescripciones
--     TRUNCATE                 !!! VACIO LA TABLA en 10 de las 11
--
-- Las 44 combinaciones de tabla × operación (SELECT/INSERT/UPDATE/DELETE)
-- respondían "PUEDE". Todo se ejecutó en transacciones revertidas.
--
-- ── Por qué siete privilegios y no cuatro ───────────────────────────────────
--
-- Retirar solo SELECT/INSERT/UPDATE/DELETE dejaba `TRUNCATE`, y un `TRUNCATE`
-- no dispara triggers de fila: 10 de las 11 seguirían siendo vaciables por un
-- visitante. Se añaden además `REFERENCES` y `TRIGGER`, el mismo residuo que
-- el sprint 4B.1 retiró de `content_items` — `TRIGGER` es la condición que
-- hace posible H-TRIGGER-001.
--
-- `MAINTAIN` se deja intacto: no lee ni escribe filas (VACUUM/ANALYZE/REINDEX)
-- y queda fuera del alcance acordado.
--
-- ── El único consumidor anónimo legítimo ────────────────────────────────────
--
-- `crm_leads` recibe altas sin sesión desde los dos formularios públicos:
--   src/routes/contactanos.tsx:64   (formulario de contacto)
--   src/routes/empresas.tsx:87      (formulario B2B)
-- Ambos solo hacen INSERT. Por eso se le devuelve `INSERT` y nada más: leer la
-- lista de leads —nombre, correo y teléfono de cada persona que escribió— es
-- justamente la exposición de terceros que ADR-013 no admite.
--
-- El resto de consumidores no necesita `anon`:
--   AdminDashboard.tsx:118        crm_leads SELECT           · admin
--   clinicalService.ts:200        clinical_prescriptions SEL · terapeuta
--                                 (getPrescriptionsCatalog, desde
--                                  TherapistDashboard.tsx:127)
--   serviceRequestsService.ts:58  service_requests INS + SEL · paciente
--   supabase.ts:59                telemetry_events INSERT    · función
--                                 `trackTelemetryEvent`, SIN NINGUNA LLAMADA
--   seeders (.cjs)                usan SERVICE_ROLE_KEY
--   Edge Functions                no mencionan ninguna de las 11
--   cron                          1 trabajo, rol postgres, ajeno
--
-- ── Idempotencia ────────────────────────────────────────────────────────────
--
-- `REVOKE` sobre un privilegio ausente no es un error, y `GRANT` sobre uno
-- presente tampoco. Sin `CASCADE`. Ejecutable las veces que haga falta: el
-- estado final es el mismo.
--
-- ── Reversión ───────────────────────────────────────────────────────────────
--
-- `supabase/backups/20260807_pre_cierre_anon_11_tablas.sql`
-- ============================================================================

REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.clinical_documents       FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.clinical_prescriptions   FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.clinical_recommendations FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.clinical_tasks           FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.family_genograms         FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.content_revisions        FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.crm_leads                FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.crm_notes                FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.service_requests         FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.telemetry_events         FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.user_guide_progress      FROM anon;

-- Único privilegio anónimo que sobrevive, y solo este.
GRANT INSERT ON TABLE public.crm_leads TO anon;
