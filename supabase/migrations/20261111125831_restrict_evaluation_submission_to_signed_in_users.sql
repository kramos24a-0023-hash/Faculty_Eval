revoke execute on function public.submit_course_evaluation(uuid, uuid, jsonb, text, boolean)
  from anon, public;

grant execute on function public.submit_course_evaluation(uuid, uuid, jsonb, text, boolean)
  to authenticated, service_role;
