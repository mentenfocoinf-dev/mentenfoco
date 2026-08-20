-- Copia de seguridad de las funciones ANTES del sprint 0.
-- Tomada de pg_get_functiondef el 2026-08-05.
-- Para revertir el sprint 0: ejecutar este archivo tal cual.

-- admin_assign_patient(uuid,uuid)
CREATE OR REPLACE FUNCTION public.admin_assign_patient(p_patient uuid, p_therapist uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if public.get_my_role() <> 'admin' then
    raise exception 'Solo un administrador puede asignar pacientes';
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
$function$
;

-- admin_get_directory()
CREATE OR REPLACE FUNCTION public.admin_get_directory()
 RETURNS json
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case
    when public.get_my_role() <> 'admin' then null
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
$function$
;

-- admin_set_plan(uuid,plan_type,text)
CREATE OR REPLACE FUNCTION public.admin_set_plan(p_user uuid, p_plan plan_type, p_status text DEFAULT 'active'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if public.get_my_role() <> 'admin' then
    raise exception 'Solo un administrador puede cambiar planes';
  end if;
  update profiles
  set plan_type = p_plan,
      subscription_status = p_status,
      updated_at = now()
  where id = p_user;
end;
$function$
;

-- admin_unassign_patient(uuid)
CREATE OR REPLACE FUNCTION public.admin_unassign_patient(p_patient uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if public.get_my_role() <> 'admin' then
    raise exception 'Solo un administrador puede modificar asignaciones';
  end if;
  delete from patient_therapist where patient_id = p_patient;
end;
$function$
;

-- check_clinical_note_immutability()
CREATE OR REPLACE FUNCTION public.check_clinical_note_immutability()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    IF OLD.is_signed = true THEN
        RAISE EXCEPTION 'INMUTABILIDAD_CLINICA: No se puede modificar ni eliminar una nota clínica que ya ha sido firmada electrónicamente. Se requiere un addendum.';
    END IF;
    RETURN NEW;
END;
$function$
;

-- evaluate_phq9_risk()
CREATE OR REPLACE FUNCTION public.evaluate_phq9_risk()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    IF NEW.item_9_score > 0 THEN
        INSERT INTO public.clinical_alerts (patient_id, test_score_id, status)
        VALUES (NEW.patient_id, NEW.id, 'high_priority');
    END IF;
    RETURN NEW;
END;
$function$
;

