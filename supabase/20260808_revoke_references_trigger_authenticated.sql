-- ============================================================================
-- Cierre de H-TRIGGER-001 en todo el esquema: se retira `REFERENCES` y
-- `TRIGGER` a `authenticated` en las 30 tablas de `public` que aún los tenían.
--
-- Alcance: dos privilegios, un rol, treinta tablas. Nada más. No se tocan
-- `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE` ni `MAINTAIN`; ni `anon`,
-- `service_role` o `postgres`; ni RLS, políticas, funciones, columnas, datos,
-- React, `content_items`, `therapist_time_blocks` ni los *default privileges*.
--
-- **No se elimina ningún trigger, ninguna función de trigger y ninguna clave
-- ajena.** Se retira el privilegio de CREARLOS, no los objetos existentes:
-- 42 triggers de usuario y 62 claves ajenas siguen exactamente donde estaban.
--
-- ── Qué cierra, medido ──────────────────────────────────────────────────────
--
-- El sprint 4M reprodujo la escalada sobre `profiles`, como paciente:
--
--     ACL de profiles.role para authenticated : UPDATE DENEGADO
--     trigger zzz_escalada                    : colgado
--     UPDATE de full_name                     : el UPDATE paso
--     role FINAL: admin   <<< ESCALADA DE PRIVILEGIOS CONFIRMADA
--
-- El mecanismo: los triggers `BEFORE` disparan en orden alfabético, así que un
-- trigger llamado `zzz_*` corre DESPUÉS del de autorización; y **PostgreSQL
-- comprueba los privilegios de columna contra las columnas nombradas en la
-- sentencia, no contra las que asigna un trigger**. El paciente hace un
-- `UPDATE` legítimo de `full_name` y su propio trigger fija `NEW.role='admin'`,
-- atravesando el endurecimiento por columna del sprint 3.
--
-- Se midió además que `CREATE TRIGGER` le está permitido pero `DROP TRIGGER`
-- no (`must be owner of relation profiles`): puede colgarlo y no quitarlo.
--
-- Alcance real del riesgo, dicho con precisión: `anon` y `authenticated` son
-- **NOLOGIN**, PostgREST no ejecuta DDL y no hay ninguna función expuesta con
-- `EXECUTE` dinámico. Explotarlo exige una conexión directa a la base. Es
-- defensa en profundidad, no el cierre de una brecha alcanzable desde la web.
--
-- ── Sin consumidores ────────────────────────────────────────────────────────
--
-- Reconfirmado antes de aplicar: cero `CREATE TRIGGER`, `ALTER TABLE`,
-- `ADD CONSTRAINT` o `FOREIGN KEY` en `src/` y en las Edge Functions · cero
-- funciones SQL con DDL · cero funciones con `EXECUTE` dinámico expuestas a
-- `authenticated` · cron sin DDL · ninguna tabla de `public` con owner distinto
-- de `postgres` · ningún trigger de `public` cuya función pertenezca a otro rol
-- (los cinco que aparecen son de `storage` y `realtime`, internos de Supabase).
--
-- Y hay un límite estructural: `authenticated` **no tiene `CREATE` en ningún
-- esquema**, así que ni siquiera podría crear una tabla donde poner una clave
-- ajena. `REFERENCES` es, para este rol, inutilizable.
--
-- ── Precedente en el propio proyecto ────────────────────────────────────────
--
-- Siete tablas de `public` ya viven sin ambos privilegios —`appointments`,
-- `content_items`, `notifications`, `therapist_contact_requests`,
-- `therapist_profiles`, `therapist_time_blocks`, `user_preferences`— y entre
-- ellas suman 17 triggers y 15 claves ajenas que funcionan con normalidad.
--
-- ── Idempotencia ────────────────────────────────────────────────────────────
--
-- `REVOKE` sobre un privilegio ausente no es un error. Sin `CASCADE`.
-- Ejecutable las veces que haga falta: el estado final es el mismo.
--
-- ── Fuera de alcance, documentado ───────────────────────────────────────────
--
-- Los *default privileges* de `public` conceden `arwdDxtm` a `anon` y
-- `authenticated` sobre toda tabla nueva. Mientras sigan así, cualquier tabla
-- creada en el futuro nacerá con estos privilegios otra vez. Es deuda separada
-- y este sprint NO la toca.
--
-- ── Reversión ───────────────────────────────────────────────────────────────
--
-- `supabase/backups/20260808_pre_revoke_references_trigger_authenticated.sql`
-- ============================================================================

REVOKE REFERENCES, TRIGGER ON TABLE public.blog_comments            FROM authenticated;
REVOKE REFERENCES, TRIGGER ON TABLE public.cie11_directory          FROM authenticated;
REVOKE REFERENCES, TRIGGER ON TABLE public.clinical_alerts          FROM authenticated;
REVOKE REFERENCES, TRIGGER ON TABLE public.clinical_consents        FROM authenticated;
REVOKE REFERENCES, TRIGGER ON TABLE public.clinical_documents       FROM authenticated;
REVOKE REFERENCES, TRIGGER ON TABLE public.clinical_guides          FROM authenticated;
REVOKE REFERENCES, TRIGGER ON TABLE public.clinical_notes           FROM authenticated;
REVOKE REFERENCES, TRIGGER ON TABLE public.clinical_prescriptions   FROM authenticated;
REVOKE REFERENCES, TRIGGER ON TABLE public.clinical_recommendations FROM authenticated;
REVOKE REFERENCES, TRIGGER ON TABLE public.clinical_tasks           FROM authenticated;
REVOKE REFERENCES, TRIGGER ON TABLE public.content_revisions        FROM authenticated;
REVOKE REFERENCES, TRIGGER ON TABLE public.crm_leads                FROM authenticated;
REVOKE REFERENCES, TRIGGER ON TABLE public.crm_notes                FROM authenticated;
REVOKE REFERENCES, TRIGGER ON TABLE public.family_genograms         FROM authenticated;
REVOKE REFERENCES, TRIGGER ON TABLE public.guides                   FROM authenticated;
REVOKE REFERENCES, TRIGGER ON TABLE public.journey_events           FROM authenticated;
REVOKE REFERENCES, TRIGGER ON TABLE public.messages                 FROM authenticated;
REVOKE REFERENCES, TRIGGER ON TABLE public.mood_entries             FROM authenticated;
REVOKE REFERENCES, TRIGGER ON TABLE public.patient_anamnesis        FROM authenticated;
REVOKE REFERENCES, TRIGGER ON TABLE public.patient_prescriptions    FROM authenticated;
REVOKE REFERENCES, TRIGGER ON TABLE public.patient_therapist        FROM authenticated;
REVOKE REFERENCES, TRIGGER ON TABLE public.profiles                 FROM authenticated;
REVOKE REFERENCES, TRIGGER ON TABLE public.psychometric_evaluations FROM authenticated;
REVOKE REFERENCES, TRIGGER ON TABLE public.public_test_submissions  FROM authenticated;
REVOKE REFERENCES, TRIGGER ON TABLE public.public_tests             FROM authenticated;
REVOKE REFERENCES, TRIGGER ON TABLE public.service_requests         FROM authenticated;
REVOKE REFERENCES, TRIGGER ON TABLE public.telemetry_events         FROM authenticated;
REVOKE REFERENCES, TRIGGER ON TABLE public.test_scores              FROM authenticated;
REVOKE REFERENCES, TRIGGER ON TABLE public.therapy_sessions         FROM authenticated;
REVOKE REFERENCES, TRIGGER ON TABLE public.user_guide_progress      FROM authenticated;
