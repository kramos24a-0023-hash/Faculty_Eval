-- Restrict authentication and role-protected access to OLOPSC school addresses.
begin;

create or replace function private.user_is_school_account()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.users u
    where u.id = (select auth.uid())
      and lower(u.email) ~ '^[^@]+@olopsc[.]edu[.]ph$'
  );
$$;

revoke all on function private.user_is_school_account() from public;
grant execute on function private.user_is_school_account() to authenticated;

create or replace function private.user_has_role(required_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.user_is_school_account() and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = required_role
  );
$$;

create or replace function public.reject_non_school_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null or lower(new.email) !~ '^[^@]+@olopsc[.]edu[.]ph$' then
    raise exception 'Only @olopsc.edu.ph accounts can access this application.' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.reject_non_school_account() from public;
create trigger on_auth_user_created_school_domain
  before insert on auth.users
  for each row execute function public.reject_non_school_account();

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'New user'),
    case when lower(new.email) = 'kramos24a-0023@olopsc.edu.ph' then 'admin' else 'student' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

update public.profiles p
set role = 'admin'
from auth.users u
where u.id = p.id
  and lower(u.email) = 'kramos24a-0023@olopsc.edu.ph';

drop policy if exists "Students and admins can read student records" on public.student_records;
create policy "School students and admins can read student records"
  on public.student_records for select to authenticated
  using (private.user_is_school_account() and (student_id = (select auth.uid()) or (select private.user_has_role('admin'))));

drop policy if exists "Students see their enrollments and admins see all" on public.student_enrollments;
create policy "School students see their enrollments and admins see all"
  on public.student_enrollments for select to authenticated
  using (private.user_is_school_account() and (student_id = (select auth.uid()) or (select private.user_has_role('admin'))));

drop policy if exists "Students see their submissions and admins see all" on public.evaluation_submissions;
create policy "School students see their submissions and admins see all"
  on public.evaluation_submissions for select to authenticated
  using (private.user_is_school_account() and (student_id = (select auth.uid()) or (select private.user_has_role('admin'))));

drop policy if exists "Students see their ratings and admins see all" on public.evaluation_ratings;
create policy "School students see their ratings and admins see all"
  on public.evaluation_ratings for select to authenticated
  using (
    private.user_is_school_account() and (
      (select private.user_has_role('admin'))
      or exists (
        select 1 from public.evaluation_submissions s
        where s.id = evaluation_ratings.submission_id and s.student_id = (select auth.uid())
      )
    )
  );

commit;
