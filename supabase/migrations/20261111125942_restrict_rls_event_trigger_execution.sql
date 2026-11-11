-- This function is invoked by PostgreSQL's ensure_rls event trigger, not through the app API.
revoke execute on function public.rls_auto_enable()
  from anon, authenticated, public;

grant execute on function public.rls_auto_enable() to postgres;
