create or replace function public.prevent_changing_surveys_after_responses()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_period_id uuid;
  v_course_id uuid;
  v_criterion_id uuid;
begin
  if tg_op = 'DELETE' then
    v_period_id := old.period_id;
    v_course_id := old.course_id;
    v_criterion_id := old.id;
  else
    v_period_id := new.period_id;
    v_course_id := new.course_id;
    v_criterion_id := new.id;
  end if;

  if tg_op = 'INSERT' and v_course_id is null and exists (
    select 1 from public.evaluation_submissions s where s.period_id = v_period_id
  ) then
    raise exception 'The standard survey cannot be changed after responses already exist.' using errcode = '22023';
  end if;

  if tg_op <> 'INSERT' and exists (
    select 1 from public.evaluation_ratings r where r.criterion_id = old.id
  ) then
    raise exception 'A survey question cannot be changed after it has responses.' using errcode = '22023';
  end if;

  if tg_op = 'UPDATE' and new.course_id is null and exists (
    select 1 from public.evaluation_submissions s where s.period_id = new.period_id
  ) then
    raise exception 'The standard survey cannot be changed after responses already exist.' using errcode = '22023';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;

revoke all on function public.prevent_changing_surveys_after_responses() from public;
