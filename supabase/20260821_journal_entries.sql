-- ============================================================================
-- Item 1 — Journaling estructurado (autocuidado). Tabla PRIVADA del paciente.
--
-- DECISIÓN DE PRODUCTO (aprobada 21-ago): diario privado por defecto, sin
-- compartir en v1; owner-only espejo de `mood_entries` PERO con DELETE del
-- propietario (un diario reflexivo es del paciente, no una nota clínica
-- firmada e inmutable). Los prompts guiados son una constante estática en
-- frontend — NO hay tabla `journal_prompts`. `prompt` guarda cuál guió la
-- entrada (o NULL = entrada libre).
--
-- SEGURIDAD: RLS activo desde el inicio. `anon` no toca la tabla. Solo el
-- propietario (auth.uid() = patient_id) lee/escribe/edita/borra lo suyo.
-- Mismo contrato que `mood_entries` (anon SELECT=false, políticas por
-- auth.uid()=patient_id).
--
-- Backup / rollback: supabase/backups/20260821_pre_journal_entries.sql (DROP).
-- Idempotente: CREATE TABLE IF NOT EXISTS + CREATE POLICY IF NOT EXISTS.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.journal_entries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  entry_date  date NOT NULL DEFAULT current_date,
  prompt      text,              -- prompt que guió la entrada; NULL = libre
  body        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS journal_entries_patient_date_idx
  ON public.journal_entries (patient_id, entry_date DESC);

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

-- Grants explícitos: anon nunca; authenticated opera (la RLS lo acota a lo suyo).
REVOKE ALL ON TABLE public.journal_entries FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.journal_entries TO authenticated;

-- Políticas owner-only (espejo de mood_entries + DELETE).
CREATE POLICY "Patients create their own journal entries"
  ON public.journal_entries FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Patients read their own journal entries"
  ON public.journal_entries FOR SELECT TO authenticated
  USING (auth.uid() = patient_id);

CREATE POLICY "Patients update their own journal entries"
  ON public.journal_entries FOR UPDATE TO authenticated
  USING (auth.uid() = patient_id)
  WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Patients delete their own journal entries"
  ON public.journal_entries FOR DELETE TO authenticated
  USING (auth.uid() = patient_id);

COMMIT;

-- ============================================================================
-- REGLA 1 — el catálogo demuestra el estado final
-- ============================================================================
SELECT
  (SELECT relrowsecurity FROM pg_class WHERE oid='public.journal_entries'::regclass)      AS rls_activo,
  (SELECT relforcerowsecurity FROM pg_class WHERE oid='public.journal_entries'::regclass) AS force_rls,
  (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='journal_entries') AS politicas_tabla,
  (SELECT array_to_string(array_agg(cmd ORDER BY cmd),',') FROM pg_policies WHERE schemaname='public' AND tablename='journal_entries') AS cmds,
  (SELECT has_table_privilege('anon','public.journal_entries','SELECT'))                  AS anon_select,
  (SELECT has_table_privilege('authenticated','public.journal_entries','SELECT'))         AS auth_select,
  (SELECT coalesce(array_to_string(relacl,', '),'-') FROM pg_class WHERE oid='public.journal_entries'::regclass) AS acl_literal,
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r') AS tablas_base,
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity) AS tablas_con_rls,
  (SELECT count(*) FROM pg_policies WHERE schemaname='public') AS politicas_total;
