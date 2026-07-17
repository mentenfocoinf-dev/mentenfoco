-- ============================================================================
-- Migration: 4-level plan tiers, admin RPCs, profile email sync, public guide
-- metadata view. Applied to production on 2026-07-03.
-- Business logic lives in the database (RPCs) so the frontend stays thin.
-- ============================================================================

-- ── 1. profiles.email (kept in sync from auth.users) ───────────────────────
alter table public.profiles add column if not exists email text;

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is distinct from u.email;

-- handle_new_user now also copies email, role and plan_type from metadata so
-- admin-created users (and webhook-created users) land with the right profile.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, role, plan_type)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url',
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'patient'),
    coalesce((new.raw_user_meta_data ->> 'plan_type')::public.plan_type, 'free')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ── 2. Plan hierarchy helpers ───────────────────────────────────────────────
create or replace function public.plan_rank(p public.plan_type)
returns int
language sql
immutable
as $$
  select case p
    when 'free' then 0
    when 'esencial' then 1
    when 'integral' then 2
    when 'premium' then 3
  end;
$$;

create or replace function public.get_my_plan_rank()
returns int
language sql
security definer
set search_path to 'public'
as $$
  select coalesce(
    (select public.plan_rank(plan_type) from public.profiles where id = auth.uid()),
    0
  );
$$;

-- ── 3. Tiered access on clinical_guides ─────────────────────────────────────
-- NOTE: RLS was found DISABLED on this table in production (policies existed
-- but were not enforced). Enabled on 2026-07-03 so plan gating actually works.
alter table public.clinical_guides enable row level security;

alter table public.clinical_guides
  add column if not exists min_plan public.plan_type not null default 'free';

-- Existing premium guides become available from the "esencial" tier upward.
update public.clinical_guides
set min_plan = 'esencial'
where es_premium = true and min_plan = 'free';

drop policy if exists "Permitir lectura de guías gratuitas" on public.clinical_guides;
drop policy if exists "Permitir lectura premium a usuarios premium" on public.clinical_guides;
drop policy if exists "Guides readable by plan level" on public.clinical_guides;

create policy "Guides readable by plan level"
on public.clinical_guides
for select
using (
  public.plan_rank(min_plan) = 0
  or public.get_my_plan_rank() >= public.plan_rank(min_plan)
  or public.get_my_role() in ('admin', 'therapist')
);

-- Public metadata view: lets the guide hub and the paywall show title, image
-- and required plan of locked guides WITHOUT exposing the clinical content.
create or replace view public.clinical_guides_meta
with (security_invoker = off)
as
select id, categoria, etiquetas, titulo, "descripcionBreve", "tiempoLectura",
       "imageName", es_premium, min_plan
from public.clinical_guides;

grant select on public.clinical_guides_meta to anon, authenticated;

-- ── 4. Admin visibility over profiles ───────────────────────────────────────
drop policy if exists "Admins read all profiles" on public.profiles;
create policy "Admins read all profiles"
on public.profiles
for select
using (public.get_my_role() = 'admin');

drop policy if exists "Admins update all profiles" on public.profiles;
create policy "Admins update all profiles"
on public.profiles
for update
using (public.get_my_role() = 'admin');

-- ── 5. Business RPCs (backend logic) ────────────────────────────────────────

-- Assign (or reassign) a patient to a therapist. One active therapist per
-- patient: previous assignments are replaced.
create or replace function public.admin_assign_patient(p_patient uuid, p_therapist uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if public.get_my_role() <> 'admin' then
    raise exception 'Solo un administrador puede asignar pacientes';
  end if;
  if (select role from profiles where id = p_patient) is distinct from 'patient' then
    raise exception 'El usuario seleccionado no es un paciente';
  end if;
  if (select role from profiles where id = p_therapist) is distinct from 'therapist' then
    raise exception 'El usuario seleccionado no es un terapeuta';
  end if;

  delete from patient_therapist where patient_id = p_patient;
  insert into patient_therapist (patient_id, therapist_id) values (p_patient, p_therapist);
end;
$$;

create or replace function public.admin_unassign_patient(p_patient uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if public.get_my_role() <> 'admin' then
    raise exception 'Solo un administrador puede modificar asignaciones';
  end if;
  delete from patient_therapist where patient_id = p_patient;
end;
$$;

-- Change a user's plan / subscription status from the admin panel.
create or replace function public.admin_set_plan(
  p_user uuid,
  p_plan public.plan_type,
  p_status text default 'active'
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
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
$$;

-- Single round-trip directory for the admin dashboard.
create or replace function public.admin_get_directory()
returns json
language sql
security definer
set search_path to 'public'
as $$
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
$$;
