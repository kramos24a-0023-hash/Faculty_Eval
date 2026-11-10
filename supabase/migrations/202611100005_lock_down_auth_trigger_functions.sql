-- Auth trigger functions should run only through their triggers, not through
-- PostgREST RPC calls from anonymous or signed-in clients.
begin;

revoke all on function public.reject_non_school_account() from public, anon, authenticated;
revoke all on function public.create_profile_for_new_user() from public, anon, authenticated;

commit;
