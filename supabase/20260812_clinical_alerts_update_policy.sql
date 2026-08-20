-- ============================================================================
-- clinical_alerts — politica de UPDATE que faltaba.
--
-- UNA politica. Nada mas.
--
-- ESTA MIGRACION NO ACTIVA RLS. `clinical_alerts` sigue con
-- `relrowsecurity = false`, igual que antes. **Por tanto esta politica queda
-- INERTE**: PostgreSQL no la evalua mientras RLS este apagado. Encenderlo es
-- el trabajo de un sprint posterior, deliberadamente separado de este.
--
-- No toca ACL, `DEFAULT PRIVILEGES`, triggers, FK, funciones, RPC, columnas,
-- indices, datos ni React. No modifica las cinco politicas existentes.
--
-- Reversion: `supabase/backups/20260812_pre_clinical_alerts_update_policy.sql`
--
-- ── El hueco que cierra ─────────────────────────────────────────────────────
--
-- La ACL concede `UPDATE` a `authenticated` (`authenticated=arwm`), pero las
-- cinco politicas de la tabla cubren solo `INSERT` y `SELECT`. El unico
-- consumidor que actualiza es `resolveCrisisAlert()`
-- (`src/lib/api/clinicalService.ts:296`), con el que un terapeuta registra que
-- atendio una alerta de crisis.
--
-- Medido replicando las cinco politicas sobre una tabla de usar y tirar, con
-- RLS activo y dentro de una transaccion revertida:
--
--   terapeuta SELECT ............ 1 fila visible   (el SELECT si funciona)
--   terapeuta UPDATE (resolver) . 0 filas afectadas   <- FALLO SILENCIOSO
--
-- No devuelve error: devuelve cero filas. Y el codigo solo comprueba
-- `if (error) throw`. El terapeuta veria el modal cerrarse con exito y la
-- alerta seguiria abierta. En el modulo de crisis ese es el peor modo de fallo
-- posible, y por eso `clinical_alerts` quedo fuera del Grupo 2.
--
-- ── Quien puede resolver, y por que ─────────────────────────────────────────
--
-- Decision de producto explicita del responsable:
--
--   terapeuta asignado ... SI, y solo sobre las alertas de sus pacientes
--   terapeuta no asignado  no
--   paciente ............. no, ni siquiera la suya
--   admin ................ NO. No existe ningun consumidor real: el modal
--                          `CrisisAlertResolutionModal` solo se monta desde
--                          `TherapistDashboard`, y `AdminDashboard` no toca
--                          esta tabla. El admin conserva su SELECT.
--   anon ................. no: la ACL lo detiene antes que RLS
--   service_role ......... si, por `bypassrls`; las Edge Functions y el
--                          seeder `seed_clinical_demo_data.cjs` no se ven
--                          afectados
--
-- ── Por que el WITH CHECK lleva `resolved_by = auth.uid()` ──────────────────
--
-- `resolveCrisisAlert` recibe `therapistId` desde el cliente. Hoy le llega
-- `profile.id` —el propio terapeuta—, de modo que el consumidor real no se
-- rompe: comprobado. Pero sin esa clausula, un terapeuta podria firmar la
-- atencion de una crisis a nombre de otro. En una historia clinica eso importa,
-- y la comprobacion no cuesta nada porque la columna ya viaja en el UPDATE.
--
-- Probado sobre la replica: firmar con un `resolved_by` ajeno devuelve
-- `42501 new row violates row-level security policy`.
--
-- ── Por que `is_therapist_of` y no una subconsulta ──────────────────────────
--
-- Las expresiones de una politica se evaluan con los privilegios del
-- INVOCANTE, y `authenticated` no tiene `SELECT` sobre `patient_therapist`
-- desde los sprints 4I-4N: una subconsulta directa daria
-- `42501 permission denied for table patient_therapist`. Es exactamente el
-- fallo que el Grupo 0 corrigio en otras ocho politicas.
--
-- `public.is_therapist_of(uuid)` ya existe —`SECURITY DEFINER`, owner
-- `postgres`, `search_path=public`, con `EXECUTE` para `authenticated`— y
-- encapsula esa consulta. **No se crea ninguna funcion nueva.**
--
-- ── Lo que esta politica NO hace ────────────────────────────────────────────
--
-- No abre `SELECT`, `INSERT` ni `DELETE`: comprobado sobre la replica, un
-- paciente ajeno sigue viendo 0 filas y recibiendo `42501` al insertar.
-- `DELETE` no necesita politica porque la ACL ya lo niega (`arwm`, sin `d`).
-- No duplica logica de ningun trigger: `clinical_alerts` no tiene ninguno.
--
-- ── Idempotencia ────────────────────────────────────────────────────────────
--
-- `DROP POLICY IF EXISTS` antes del `CREATE`, limitado a esta politica y a
-- esta tabla. Sin `CASCADE`. Ejecutable las veces que haga falta.
-- ============================================================================

DROP POLICY IF EXISTS "Therapists resolve alerts of assigned patients"
  ON public.clinical_alerts;

CREATE POLICY "Therapists resolve alerts of assigned patients"
  ON public.clinical_alerts
  AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING (public.is_therapist_of(patient_id))
  WITH CHECK (
    public.is_therapist_of(patient_id)
    AND resolved_by = auth.uid()
  );
