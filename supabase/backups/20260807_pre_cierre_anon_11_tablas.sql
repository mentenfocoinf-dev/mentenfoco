-- ============================================================================
-- BACKUP — ACL del rol `anon` sobre 11 tablas, ANTES del sprint 4I.
-- Capturado de `pg_class.relacl` el 2026-08-07.
--
-- ── Estado literal de partida ───────────────────────────────────────────────
--
-- Las once tienen exactamente la misma ACL:
--
--   {postgres=arwdDxtm/postgres,
--    anon=arwdDxtm/postgres,
--    authenticated=arwdDxtm/postgres,
--    service_role=arwdDxtm/postgres}
--
-- Letras: a=INSERT r=SELECT w=UPDATE d=DELETE D=TRUNCATE x=REFERENCES
--         t=TRIGGER m=MAINTAIN
--
-- Es decir: `anon` —sin ninguna sesión— tenía los OCHO privilegios sobre
-- las once tablas. Ninguna tiene trigger. RLS `false` en todas; las políticas
-- que existen están inertes.
--
--   clinical_documents         0 filas · 2 políticas inertes
--   clinical_prescriptions    14 filas · 1
--   clinical_recommendations   0 filas · 2
--   clinical_tasks             0 filas · 3
--   family_genograms           0 filas · 0
--   content_revisions          0 filas · 0
--   crm_leads                  0 filas · 2
--   crm_notes                  0 filas · 1
--   service_requests           1 fila  · 0
--   telemetry_events           0 filas · 2
--   user_guide_progress        0 filas · 1
--
-- ── Qué revierte este archivo ───────────────────────────────────────────────
--
-- Devuelve los siete privilegios que retira la migración. `MAINTAIN` no
-- aparece porque la migración no lo toca: sigue concedido en todo momento.
--
-- Ejecutar este archivo deja la ACL de las once idéntica a la de arriba,
-- incluido el `INSERT` de `crm_leads` que la migración vuelve a conceder.
--
-- No se restaura nada más: la migración no toca datos, ni RLS, ni triggers,
-- ni funciones, ni columnas, ni `authenticated`, ni `service_role`, ni
-- `postgres`, ni `content_items`.
--
-- `GRANT` es idempotente: repetirlo no cambia nada.
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.clinical_documents       TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.clinical_prescriptions   TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.clinical_recommendations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.clinical_tasks           TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.family_genograms         TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.content_revisions        TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.crm_leads                TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.crm_notes                TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.service_requests         TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.telemetry_events         TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.user_guide_progress      TO anon;
