-- ============================================================================
-- Journey Engine — registro del recorrido del usuario.
--
-- Infraestructura interna. NO altera la experiencia, no muestra nada al
-- paciente y no añade fricción: toda escritura es asincrona y su fallo es
-- silencioso (ver journeyService.ts).
--
-- ── ADVERTENCIA DE PRIVACIDAD, LEER ANTES DE CONSULTAR ESTA TABLA ──────────
--
-- Aunque no guarda respuestas ni texto libre, la SECUENCIA de eventos de una
-- misma persona es, de hecho, informacion de salud: saber que alguien vio la
-- guia de ideacion suicida y despues abrio las lineas de crisis dice tanto como
-- una respuesta de un cuestionario.
--
-- Consecuencias que se implementan abajo:
--   1. `anon` NO puede leer esta tabla (GRANT/REVOKE, no RLS — ADR-013).
--   2. La tabla es append-only por trigger: un evento es un hecho, no un
--      registro editable.
--   3. `metadata` tiene tope de tamano para que nadie meta texto libre dentro.
--   4. No se guarda IP ni user agent completo (ver notas de cada columna).
--
-- Pendiente para la fase de seguridad: RLS, politica de retencion (estos datos
-- no deberian conservarse indefinidamente) y decision sobre anonimizacion
-- retroactiva del historial de un paciente que revoque su consentimiento.
--
-- NOTA: `telemetry_events` (5 columnas, sin uso real en el codigo) se deja
-- intacta. No se migra ni se borra: no hay datos que perder y borrarla no es
-- parte de este sprint.
-- ============================================================================

CREATE TABLE IF NOT EXISTS journey_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),

  -- Identidad. Uno de los dos, nunca ninguno: un evento sin sujeto no sirve
  -- para reconstruir un recorrido y solo ocupa espacio.
  user_id      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  anonymous_id text,
  -- Agrupa los eventos de una misma visita. Se regenera al cerrar la pestana:
  -- vive en sessionStorage, no en localStorage.
  session_id   text NOT NULL,

  event_name  text NOT NULL,
  page        text,
  -- De donde viene el evento: 'web', y en el futuro 'mobile' | 'edge'.
  source      text NOT NULL DEFAULT 'web',
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Se declara para no requerir migracion el dia que exista una finalidad y una
  -- estrategia de hash, pero HOY SE DEJA SIEMPRE NULL a proposito: no hay
  -- proposito definido para la IP de alguien que lee sobre su salud mental, y
  -- "por si acaso" no es una finalidad valida (Ley 1581 art. 5, RGPD art. 9).
  ip_hash     text,

  -- NO es el user agent completo. Guarda solo la categoria de dispositivo
  -- ('mobile' | 'tablet' | 'desktop'). La cadena completa es un vector de
  -- fingerprinting y el sprint lo prohibe explicitamente; la categoria da el
  -- dato util (donde se usa el producto) sin identificar a nadie.
  user_agent  text,

  referrer     text,
  utm_source   text,
  utm_medium   text,
  utm_campaign text,
  utm_content  text,
  utm_term     text,

  -- Un evento sin sujeto no reconstruye ningun recorrido.
  CONSTRAINT journey_events_tiene_sujeto_check
    CHECK (user_id IS NOT NULL OR anonymous_id IS NOT NULL),
  -- Convencion estable: SCREAMING_SNAKE_CASE. Sin esto, en dos anos conviven
  -- 'test_started', 'TestStarted' y 'TEST_STARTED' como si fueran distintos.
  CONSTRAINT journey_events_nombre_formato_check
    CHECK (event_name ~ '^[A-Z][A-Z0-9_]{2,63}$'),
  CONSTRAINT journey_events_source_check
    CHECK (source IN ('web', 'mobile', 'edge')),
  -- Tope de tamano: `metadata` es para identificadores y numeros, no para
  -- texto. 2 KB caben de sobra y hacen imposible colar una respuesta libre.
  CONSTRAINT journey_events_metadata_acotada_check
    CHECK (pg_column_size(metadata) <= 2048)
);

-- ── Indices ─────────────────────────────────────────────────────────────────
-- Pensados para las tres preguntas que el Sprint 2 va a hacer: que pasa con un
-- evento, que hizo una persona, y que ocurrio en una visita.
CREATE INDEX IF NOT EXISTS journey_events_name_idx
  ON journey_events (event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS journey_events_user_idx
  ON journey_events (user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS journey_events_anon_idx
  ON journey_events (anonymous_id, created_at DESC) WHERE anonymous_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS journey_events_session_idx
  ON journey_events (session_id, created_at);
-- Atribucion de campanas: solo interesan las filas que traen utm.
CREATE INDEX IF NOT EXISTS journey_events_utm_idx
  ON journey_events (utm_source, created_at DESC) WHERE utm_source IS NOT NULL;

-- ── Un evento es un hecho: no se edita ni se borra ──────────────────────────
--
-- Trigger y no policy, por el motivo de siempre: con RLS apagado una policy no
-- filtra nada. Reescribir un evento seria falsificar el recorrido; borrarlo de
-- a uno, ocultarlo. La purga por retencion es cosa de la fase de seguridad y se
-- hara con un job que suspenda el trigger a proposito, no desde el cliente.
CREATE OR REPLACE FUNCTION enforce_journey_event_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'JOURNEY_EVENT_APPEND_ONLY: un evento del recorrido no se modifica ni se borra.';
END;
$$;

DROP TRIGGER IF EXISTS trg_journey_event_append_only ON journey_events;
CREATE TRIGGER trg_journey_event_append_only
  BEFORE UPDATE OR DELETE ON journey_events
  FOR EACH ROW EXECUTE FUNCTION enforce_journey_event_append_only();

-- ── Nadie lee el recorrido ajeno desde una ruta publica ─────────────────────
--
-- Mismo criterio y mismo mecanismo que en public_test_submissions (ADR-013):
-- GRANT/REVOKE son permisos de tabla de Postgres y NO son RLS, asi que esto no
-- activa row level security en ninguna tabla.
--
-- `anon` y `authenticated` conservan INSERT (cualquiera genera sus propios
-- eventos) y pierden SELECT: un paciente no puede leer el recorrido de otro, y
-- un visitante no puede leer ninguno.
REVOKE SELECT ON journey_events FROM anon;
REVOKE SELECT ON journey_events FROM authenticated;
GRANT INSERT ON journey_events TO anon;
GRANT INSERT ON journey_events TO authenticated;

-- ============================================================================
-- FASE DE SEGURIDAD (no aplicar todavia: RLS esta desactivado a proposito en
-- todo el proyecto; ver 00 Indice maestro / Decisiones tecnicas).
--
-- ALTER TABLE journey_events ENABLE ROW LEVEL SECURITY;
--
-- -- Cualquiera registra sus propios eventos.
-- CREATE POLICY journey_events_insert_todos ON journey_events
--   FOR INSERT WITH CHECK (true);
--
-- -- Solo el admin lee. Ni siquiera el terapeuta: el recorrido de navegacion de
-- -- su paciente no es historia clinica y no lo necesita para acompanarlo.
-- CREATE POLICY journey_events_select_admin ON journey_events
--   FOR SELECT USING (
--     EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
--   );
--
-- -- Sin policies de UPDATE ni DELETE (ademas del trigger).
--
-- PENDIENTE ADEMAS DE RLS:
--   · Politica de retencion (propuesta: 24 meses, purga por job).
--   · Que hacer con el historial cuando un paciente revoca su consentimiento
--     clinico o solicita supresion (Ley 1581 art. 8).
-- ============================================================================
