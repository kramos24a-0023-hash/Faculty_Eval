alter table public.evaluation_criteria
  add column if not exists course_id uuid references public.courses(id) on delete cascade;

alter table public.evaluation_criteria
  drop constraint if exists evaluation_criteria_period_id_sort_order_key;

create unique index if not exists evaluation_criteria_active_period_order_unique
  on public.evaluation_criteria (period_id, sort_order)
  where course_id is null and is_active;

create unique index if not exists evaluation_criteria_active_course_order_unique
  on public.evaluation_criteria (period_id, course_id, sort_order)
  where course_id is not null and is_active;

create or replace function public.prevent_changing_surveys_after_responses()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_period_id uuid;
  v_course_id uuid;
begin
  if tg_op = 'DELETE' then
    v_period_id := old.period_id;
    v_course_id := old.course_id;
  else
    v_period_id := new.period_id;
    v_course_id := new.course_id;
  end if;

  if exists (
    select 1
    from public.evaluation_submissions s
    where s.period_id = v_period_id
      and (v_course_id is null or s.course_id = v_course_id)
  ) then
    raise exception 'Surveys cannot be changed after responses already exist.' using errcode = '22023';
  end if;

  if tg_op = 'UPDATE' and (old.period_id is distinct from new.period_id or old.course_id is distinct from new.course_id) then
    if exists (
      select 1
      from public.evaluation_submissions s
      where s.period_id = old.period_id
        and (old.course_id is null or s.course_id = old.course_id)
    ) then
      raise exception 'Surveys cannot be changed after responses already exist.' using errcode = '22023';
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;

drop trigger if exists evaluation_criteria_lock_after_submissions on public.evaluation_criteria;
create trigger evaluation_criteria_lock_after_submissions
before insert or update or delete on public.evaluation_criteria
for each row execute function public.prevent_changing_surveys_after_responses();

create or replace function public.submit_course_evaluation(
  p_course_id uuid,
  p_period_id uuid,
  p_ratings jsonb,
  p_comment text default null,
  p_comment_anonymous boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_student_id uuid := (select auth.uid());
  v_submission_id uuid;
  v_expected_count integer;
  v_provided_count integer;
  v_distinct_count integer;
  v_comment text := nullif(trim(coalesce(p_comment, '')), '');
  v_student_name text;
begin
  if v_student_id is null or not private.user_has_role('student') then
    raise exception 'Only signed-in students can submit evaluations.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.student_enrollments e
    where e.student_id = v_student_id and e.course_id = p_course_id and e.period_id = p_period_id
  ) then
    raise exception 'This course is not assigned to this student for the selected period.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.evaluation_periods ep
    where ep.id = p_period_id and ep.is_open and ep.starts_at <= now() and ep.ends_at >= now()
  ) then
    raise exception 'This evaluation period is not open.' using errcode = '22023';
  end if;

  if v_comment is not null and length(v_comment) > 600 then
    raise exception 'Comments must be 600 characters or fewer.' using errcode = '22023';
  end if;

  if p_ratings is null or jsonb_typeof(p_ratings) <> 'array' then
    raise exception 'Ratings must include every required criterion.' using errcode = '22023';
  end if;

  select count(*) into v_expected_count
  from public.evaluation_criteria c
  where c.period_id = p_period_id and c.is_active
    and (c.course_id = p_course_id or (c.course_id is null and not exists (
      select 1 from public.evaluation_criteria custom
      where custom.period_id = p_period_id and custom.course_id = p_course_id and custom.is_active
    )));

  select count(*), count(distinct r.criterion_id)
    into v_provided_count, v_distinct_count
  from jsonb_to_recordset(p_ratings) as r(criterion_id uuid, rating integer);

  if v_expected_count = 0 or v_provided_count <> v_expected_count or v_distinct_count <> v_expected_count then
    raise exception 'Ratings must include each required criterion exactly once.' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_to_recordset(p_ratings) as r(criterion_id uuid, rating integer)
    left join public.evaluation_criteria c on c.id = r.criterion_id and c.period_id = p_period_id and c.is_active
      and (c.course_id = p_course_id or (c.course_id is null and not exists (
        select 1 from public.evaluation_criteria custom
        where custom.period_id = p_period_id and custom.course_id = p_course_id and custom.is_active
      )))
    where c.id is null or r.rating < 1 or r.rating > 5
  ) then
    raise exception 'A rating or criterion is invalid.' using errcode = '22023';
  end if;

  select p.full_name into v_student_name
  from public.profiles p where p.id = v_student_id;

  insert into public.evaluation_submissions (student_id, course_id, period_id)
  values (v_student_id, p_course_id, p_period_id)
  returning id into v_submission_id;

  insert into public.evaluation_ratings (submission_id, criterion_id, rating)
  select v_submission_id, r.criterion_id, r.rating::smallint
  from jsonb_to_recordset(p_ratings) as r(criterion_id uuid, rating integer);

  if v_comment is not null then
    insert into public.evaluation_comments (
      submission_id, course_id, period_id, body, is_anonymous, professor_visible_name
    ) values (
      v_submission_id, p_course_id, p_period_id, v_comment,
      coalesce(p_comment_anonymous, true),
      case when coalesce(p_comment_anonymous, true) then null else v_student_name end
    );
  end if;

  return v_submission_id;
end;
$function$;

revoke all on function public.submit_course_evaluation(uuid, uuid, jsonb, text, boolean) from public;
grant execute on function public.submit_course_evaluation(uuid, uuid, jsonb, text, boolean) to authenticated;
