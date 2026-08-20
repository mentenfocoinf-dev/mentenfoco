-- ============================================================================
-- GRUPO 1 — Primera activacion de RLS en Mente en Foco.
--
-- Alcance: DOS tablas y CINCO politicas. Ninguna otra tabla, ningun otro
-- objeto. No toca ACL, triggers, FK, funciones, RPC, columnas, indices, datos
-- ni React.
--
--   public.mood_entries      -> RLS ON + 3 politicas
--   public.service_requests  -> RLS ON + 2 politicas
--
-- Al terminar: RLS activo en 2 de 37 tablas. FORCE RLS sigue en 0.
--
-- Reversion: `supabase/backups/20260812_pre_grupo1_rls.sql`
--
-- ── Por que estas dos, y no otras ───────────────────────────────────────────
--
-- Son las unicas dos tablas del esquema que cumplen las cinco condiciones a la
-- vez, medidas en la auditoria previa:
--
--   * un solo dueno por fila (`patient_id`), sin modelos de pertenencia mixtos;
--   * CERO funciones de `public` las mencionan -> ninguna RPC `SECURITY
--     DEFINER` las consulta, asi que el hallazgo del sprint 4Q (RLS no alcanza
--     a las 31 RPC, porque `postgres` tiene `bypassrls`) NO las afecta: aqui
--     RLS es la unica puerta y funciona entera;
--   * un unico consumidor en el frontend cada una, y en ambos casos recibe
--     `profile.id` -el usuario con sesion-, nunca un id arbitrario;
--   * cero triggers y cero politicas previas: no hay autorizacion que duplicar
--     ni que contradecir;
--   * `anon` no tiene ningun privilegio DML sobre ellas.
--
-- ── La fuga que cierran, medida antes de escribir esto ──────────────────────
--
-- Sondeado por un paciente real con CERO filas propias en ambas tablas, de
-- modo que cualquier fila que viera fuese, por definicion, ajena:
--
--   SELECT * FROM mood_entries               -> LEIA 1 fila AJENA
--   SELECT * FROM service_requests           -> LEIA 1 fila AJENA
--   INSERT mood_entries con patient_id ajeno -> INSERTABA a nombre de otro
--   UPDATE mood_entries de otro paciente     -> MODIFICABA fila ajena
--   UPDATE service_requests de otro paciente -> MODIFICABA fila ajena
--
-- El frontend filtra con `.eq("patient_id", patientId)`, pero ese filtro vive
-- en el cliente: nada impedia enviar el id de otra persona.
--
-- ── Por que `mood_entries` necesita INSERT *y* UPDATE por separado ──────────
--
-- `moodService.saveTodayMood` usa `.upsert(..., { onConflict:
-- "patient_id,entry_date" })`, que PostgREST traduce a
-- `INSERT ... ON CONFLICT DO UPDATE`. Esa sentencia evalua la politica de
-- INSERT en la rama de alta y la de UPDATE en la rama de conflicto: con una
-- sola de las dos, el upsert falla la mitad de las veces. El indice unico que
-- respalda el conflicto es `mood_entries_one_per_day`.
--
-- ── Por que `service_requests` NO lleva politica de UPDATE ──────────────────
--
-- Nadie actualiza esa tabla desde la aplicacion: el unico consumidor es
-- `createServiceRequest` (INSERT). Sin politica de UPDATE, RLS lo cierra por
-- completo para `authenticated` — que es justamente lo que hace falta, porque
-- hoy un paciente puede cambiar el `status` de la solicitud de otro. El dia
-- que exista un panel de administracion que lo necesite, se anadira su
-- politica en su propio sprint.
--
-- ── Por que NO hay politica de DELETE en ninguna de las dos ─────────────────
--
-- La ACL ya lo niega: `authenticated=arwm` en ambas, sin `d`. Medido
-- ejecutando: `DELETE` devuelve `42501`. Una politica de DELETE seria letra
-- muerta y daria la impresion de que el borrado esta contemplado.
--
-- ── Por que NO hay politicas para `anon` ni para `service_role` ─────────────
--
-- `anon` no tiene privilegios DML sobre ninguna de las dos: la ACL lo detiene
-- antes de que RLS entre en juego, y asi debe seguir. `service_role` tiene
-- `bypassrls = true`, de modo que una politica para el no se evaluaria nunca;
-- las Edge Functions y los seeders no se ven afectados.
--
-- ── Idempotencia ────────────────────────────────────────────────────────────
--
-- `ENABLE ROW LEVEL SECURITY` sobre una tabla que ya lo tiene activo no es un
-- error. Cada politica va precedida de su `DROP POLICY IF EXISTS`, limitado a
-- estas dos tablas. Sin `CASCADE`. Ejecutable las veces que haga falta: el
-- estado final es el mismo.
-- ============================================================================


-- ─── public.mood_entries ────────────────────────────────────────────────────

ALTER TABLE public.mood_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Patients read their own mood entries" ON public.mood_entries;
CREATE POLICY "Patients read their own mood entries"
  ON public.mood_entries
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (auth.uid() = patient_id);

DROP POLICY IF EXISTS "Patients create their own mood entries" ON public.mood_entries;
CREATE POLICY "Patients create their own mood entries"
  ON public.mood_entries
  AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = patient_id);

-- Rama de conflicto del upsert. USING decide que filas son actualizables;
-- WITH CHECK impide que la fila resultante quede a nombre de otra persona.
DROP POLICY IF EXISTS "Patients update their own mood entries" ON public.mood_entries;
CREATE POLICY "Patients update their own mood entries"
  ON public.mood_entries
  AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING (auth.uid() = patient_id)
  WITH CHECK (auth.uid() = patient_id);


-- ─── public.service_requests ────────────────────────────────────────────────

ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Patients read their own service requests" ON public.service_requests;
CREATE POLICY "Patients read their own service requests"
  ON public.service_requests
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (auth.uid() = patient_id);

DROP POLICY IF EXISTS "Patients create their own service requests" ON public.service_requests;
CREATE POLICY "Patients create their own service requests"
  ON public.service_requests
  AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = patient_id);
