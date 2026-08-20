-- ============================================================================
-- SPRINT 0 — Cerrar el bypass de las funciones administrativas.
--
-- No se tocan tablas. No se toca RLS. No se toca React. Solo guardias.
--
-- ── El defecto ──────────────────────────────────────────────────────────────
--
-- Las cuatro funciones `admin_*` comprobaban así:
--
--     IF public.get_my_role() <> 'admin' THEN RAISE EXCEPTION ...
--
-- `get_my_role()` lee `profiles WHERE id = auth.uid()`. Sin sesión no hay fila y
-- devuelve NULL. En PL/pgSQL `NULL <> 'admin'` no es TRUE, es NULL, y un
-- `IF NULL THEN` NO entra: la excepción nunca se lanzaba. La guardia rechazaba
-- al paciente autenticado y dejaba pasar al anónimo — exactamente al revés.
--
-- Demostrado con `SET LOCAL ROLE anon` y rollback forzado, antes de este
-- archivo:
--
--     1 get_my_role() sin sesion = NULL
--     2 NULL <> 'admin' evalua a: NULL (el IF no entra)
--     3 admin_get_directory: VUELCA 6 pacientes y 1 terapeutas, con correo
--     4 admin_set_plan sin sesion: EJECUTADO (esencial -> premium)
--     6 paciente logueado: rechazado correctamente
--
-- La línea 6 es la que lo cierra: con sesión sí protegía. El agujero era
-- precisamente para quien no la tenía.
--
-- ── La corrección ───────────────────────────────────────────────────────────
--
--     IF auth.uid() IS NULL OR public.get_my_role() IS DISTINCT FROM 'admin'
--
-- `IS DISTINCT FROM` trata NULL como un valor más y devuelve TRUE, así que el
-- IF entra. La comprobación de `auth.uid()` es redundante con eso, pero se deja
-- escrita: dice en voz alta cuál era el caso olvidado.
--
-- ── Sobre `search_path` ─────────────────────────────────────────────────────
--
-- Las cuatro ya tenían `SET search_path TO 'public'`. Se cambia a
-- `public, pg_temp` con `pg_temp` AL FINAL. El motivo: `anon` y `authenticated`
-- tienen privilegio TEMP sobre la base —comprobado— y cuando `pg_temp` no se
-- nombra, PostgreSQL puede resolver relaciones contra el esquema temporal antes
-- que contra los listados.
--
-- Honestidad sobre el alcance: INTENTÉ explotarlo y NO pude. Creando una tabla
-- temporal `profiles` como `authenticated`, `get_my_role()` siguió devolviendo
-- `patient` y `admin_set_plan` siguió rechazando. Así que esto no es el cierre
-- de una brecha demostrada, sino una defensa en profundidad barata. Lo digo
-- para que no se lea como más de lo que es.
--
-- ── Dos funciones fuera de las cuatro ───────────────────────────────────────
--
-- `check_clinical_note_immutability` y `evaluate_phq9_risk` son las únicas dos
-- SECURITY DEFINER de todo el esquema SIN `search_path` fijado. La segunda
-- escribe en `clinical_alerts`. Es la misma línea y el mismo riesgo residual,
-- así que se incluyen: dejarlas fuera por respetar el número "cuatro" sería
-- cumplir la letra del sprint incumpliendo su objetivo. Tampoco pude explotarlas.
--
-- ── Reversión ───────────────────────────────────────────────────────────────
--
-- `supabase/backups/20260805_pre_sprint0_funciones.sql` contiene los seis
-- cuerpos tal como estaban. Ejecutarlo deshace este archivo por completo.
-- ============================================================================

-- ── 1. admin_get_directory ──────────────────────────────────────────────────
--
-- Sigue devolviendo NULL en vez de lanzar excepción, a diferencia de las otras
-- tres. No es descuido: es una función SQL que devuelve json y ese NULL es el
-- contrato que el panel de administración ya consume. Convertirla a plpgsql
-- para poder lanzar cambiaría el comportamiento del frontend, y este sprint
-- dice explícitamente que React no se toca.
CREATE OR REPLACE FUNCTION public.admin_get_directory()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  select case
    when auth.uid() is null
      or public.get_my_role() is distinct from 'admin' then null
    else json_build_object(
      'therapists', (
        select coalesce(json_agg(json_build_object(
          'id', t.id, 'full_name', t.full_name, 'email', t.email,
          'subscription_status', t.subscription_status,
          'patient_count', (select count(*) from patient_therapist pt where pt.therapist_id = t.id)
        ) order by t.full_name), '[]'::json)
        from profiles t where t.role = 'therapist'
      ),
      'patients', (
        select coalesce(json_agg(json_build_object(
          'id', p.id, 'full_name', p.full_name, 'email', p.email,
          'plan_type', p.plan_type, 'subscription_status', p.subscription_status,
          'updated_at', p.updated_at,
          'therapist_id', (select pt.therapist_id from patient_therapist pt where pt.patient_id = p.id limit 1),
          'therapist_name', (
            select t2.full_name from patient_therapist pt
            join profiles t2 on t2.id = pt.therapist_id
            where pt.patient_id = p.id limit 1
          )
        ) order by p.updated_at desc), '[]'::json)
        from profiles p where p.role = 'patient'
      )
    )
  end;
$function$;

-- ── 2. admin_set_plan ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_set_plan(
  p_user uuid,
  p_plan plan_type,
  p_status text DEFAULT 'active'::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if auth.uid() is null or public.get_my_role() is distinct from 'admin' then
    raise exception 'ADMIN_REQUIRED: solo un administrador puede cambiar planes';
  end if;
  update profiles
  set plan_type = p_plan,
      subscription_status = p_status,
      updated_at = now()
  where id = p_user;
end;
$function$;

-- ── 3. admin_assign_patient ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_assign_patient(p_patient uuid, p_therapist uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if auth.uid() is null or public.get_my_role() is distinct from 'admin' then
    raise exception 'ADMIN_REQUIRED: solo un administrador puede asignar pacientes';
  end if;
  if (select role from profiles where id = p_patient) is distinct from 'patient'::user_role then
    raise exception 'El usuario seleccionado no es un paciente';
  end if;
  if (select role from profiles where id = p_therapist) is distinct from 'therapist'::user_role then
    raise exception 'El usuario seleccionado no es un terapeuta';
  end if;

  delete from patient_therapist where patient_id = p_patient;
  insert into patient_therapist (patient_id, therapist_id) values (p_patient, p_therapist);
end;
$function$;

-- ── 4. admin_unassign_patient ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_unassign_patient(p_patient uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if auth.uid() is null or public.get_my_role() is distinct from 'admin' then
    raise exception 'ADMIN_REQUIRED: solo un administrador puede modificar asignaciones';
  end if;
  delete from patient_therapist where patient_id = p_patient;
end;
$function$;

-- ── 5 y 6. Las dos sin search_path ──────────────────────────────────────────
--
-- Cuerpos idénticos. Lo único que cambia es la cláusula SET.
CREATE OR REPLACE FUNCTION public.check_clinical_note_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    IF OLD.is_signed = true THEN
        RAISE EXCEPTION 'INMUTABILIDAD_CLINICA: No se puede modificar ni eliminar una nota clínica que ya ha sido firmada electrónicamente. Se requiere un addendum.';
    END IF;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.evaluate_phq9_risk()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    IF NEW.item_9_score > 0 THEN
        INSERT INTO public.clinical_alerts (patient_id, test_score_id, status)
        VALUES (NEW.patient_id, NEW.id, 'high_priority');
    END IF;
    RETURN NEW;
END;
$function$;
