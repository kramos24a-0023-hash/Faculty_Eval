-- Permit only explicitly allowlisted personal addresses to be provisioned as
-- administrator accounts. Public self-registration remains disabled.
begin;

create table if not exists private.admin_email_allowlist (
  email text primary key,
  created_at timestamptz not null default now(),
  constraint admin_email_allowlist_normalized check (
    email = lower(trim(email))
    and email ~ '^[^@]+@[^@]+[.][^@]+$'
  )
);

revoke all on table private.admin_email_allowlist from public, anon, authenticated;

create or replace function public.reject_non_school_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null
    or (
      lower(trim(new.email)) !~ '^[^@]+@olopsc[.]edu[.]ph$'
      and not exists (
        select 1
        from private.admin_email_allowlist allowed
        where allowed.email = lower(trim(new.email))
      )
    )
  then
    raise exception 'Only school accounts or explicitly authorized administrator accounts can access this application.' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.reject_non_school_account() from public;

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
    case
      when lower(new.email) = 'kramos24a-0023@olopsc.edu.ph'
        or exists (
          select 1
          from private.admin_email_allowlist allowed
          where allowed.email = lower(trim(new.email))
        )
      then 'admin'
      else 'student'
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.create_profile_for_new_user() from public;

commit;
