-- Keep student and professor access on school email while allowing the
-- already-provisioned administrator to use a personal email address.
begin;

create or replace function private.user_is_school_account()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users u
    left join public.profiles p on p.id = u.id
    where u.id = (select auth.uid())
      and (
        lower(u.email) ~ '^[^@]+@olopsc[.]edu[.]ph$'
        or p.role = 'admin'
      )
  );
$$;

revoke all on function private.user_is_school_account() from public;
grant execute on function private.user_is_school_account() to authenticated;

commit;
