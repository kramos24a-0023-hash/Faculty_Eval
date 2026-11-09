-- OLOPSC faculty evaluation schema.
-- Admins can identify students and read all results. Professors can read only
-- comments for their assigned courses; names are exposed only for nonanonymous comments.

begin;

create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null default 'student' check (role in ('admin', 'student', 'professor')),
  created_at timestamptz not null default now()
);

create table if not exists public.student_records (
  student_id uuid primary key references public.profiles(id) on delete cascade,
  school_student_id text not null unique,
  enrollment_date date,
  program_id uuid references public.programs(id) on delete set null,
  year_level text
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete restrict,
  code text not null,
  name text not null,
  unique (program_id, code)
);

create table if not exists public.course_professors (
  course_id uuid not null references public.courses(id) on delete cascade,
  professor_id uuid not null references public.profiles(id) on delete cascade,
  primary key (course_id, professor_id)
);

create table if not exists public.evaluation_periods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  school_year text not null,
  semester text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_open boolean not null default false,
  check (ends_at > starts_at)
);

create table if not exists public.student_enrollments (
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete restrict,
  period_id uuid not null references public.evaluation_periods(id) on delete cascade,
  primary key (student_id, course_id, period_id)
);

create table if not exists public.evaluation_criteria (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.evaluation_periods(id) on delete cascade,
  prompt text not null,
  sort_order integer not null,
  is_active boolean not null default true,
  unique (period_id, sort_order)
);

-- Identity is stored here for admin transparency; professors cannot read this table.
create table if not exists public.evaluation_submissions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete restrict,
  course_id uuid not null references public.courses(id) on delete restrict,
  period_id uuid not null references public.evaluation_periods(id) on delete restrict,
  submitted_at timestamptz not null default now(),
  unique (student_id, course_id, period_id)
);

create table if not exists public.evaluation_ratings (
  submission_id uuid not null references public.evaluation_submissions(id) on delete cascade,
  criterion_id uuid not null references public.evaluation_criteria(id) on delete restrict,
  rating smallint not null check (rating between 1 and 5),
  primary key (submission_id, criterion_id)
);

-- No student_id is stored on comments. Admins can trace via submission_id,
-- while professors only see comment text and an optional name.
create table if not exists public.evaluation_comments (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references public.evaluation_submissions(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete restrict,
  period_id uuid not null references public.evaluation_periods(id) on delete restrict,
  body text not null check (length(body) <= 600),
  is_anonymous boolean not null default true,
  professor_visible_name text,
  created_at timestamptz not null default now(),
  check (
    (is_anonymous and professor_visible_name is null)
    or (not is_anonymous and professor_visible_name is not null)
  )
);

create index if not exists submissions_student_period_idx
  on public.evaluation_submissions (student_id, period_id);
create index if not exists submissions_course_period_idx
  on public.evaluation_submissions (course_id, period_id);
create index if not exists comments_course_period_idx
  on public.evaluation_comments (course_id, period_id);

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.user_has_role(required_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = required_role
  );
$$;

create or replace function private.professor_teaches_course(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.user_has_role('professor') and exists (
    select 1 from public.course_professors cp
    where cp.course_id = target_course_id and cp.professor_id = (select auth.uid())
  );
$$;

revoke all on function private.user_has_role(text) from public;
revoke all on function private.professor_teaches_course(uuid) from public;
grant execute on function private.user_has_role(text) to authenticated;
grant execute on function private.professor_teaches_course(uuid) to authenticated;

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
    'student'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.create_profile_for_new_user() from public;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

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
as $$
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
  where c.period_id = p_period_id and c.is_active;

  select count(*), count(distinct r.criterion_id)
    into v_provided_count, v_distinct_count
  from jsonb_to_recordset(p_ratings) as r(criterion_id uuid, rating integer);

  if v_expected_count = 0 or v_provided_count <> v_expected_count or v_distinct_count <> v_expected_count then
    raise exception 'Ratings must include each required criterion exactly once.' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_to_recordset(p_ratings) as r(criterion_id uuid, rating integer)
    left join public.evaluation_criteria c
      on c.id = r.criterion_id and c.period_id = p_period_id and c.is_active
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
    )
    values (
      v_submission_id, p_course_id, p_period_id, v_comment,
      coalesce(p_comment_anonymous, true),
      case when coalesce(p_comment_anonymous, true) then null else v_student_name end
    );
  end if;

  return v_submission_id;
end;
$$;

revoke all on function public.submit_course_evaluation(uuid, uuid, jsonb, text, boolean) from public;
grant execute on function public.submit_course_evaluation(uuid, uuid, jsonb, text, boolean) to authenticated;

alter table public.programs enable row level security;
alter table public.profiles enable row level security;
alter table public.student_records enable row level security;
alter table public.courses enable row level security;
alter table public.course_professors enable row level security;
alter table public.evaluation_periods enable row level security;
alter table public.student_enrollments enable row level security;
alter table public.evaluation_criteria enable row level security;
alter table public.evaluation_submissions enable row level security;
alter table public.evaluation_ratings enable row level security;
alter table public.evaluation_comments enable row level security;

grant select, insert, update, delete on public.programs, public.courses,
  public.course_professors, public.evaluation_periods, public.student_enrollments,
  public.evaluation_criteria, public.student_records to authenticated;
grant select on public.profiles, public.evaluation_submissions,
  public.evaluation_ratings, public.evaluation_comments to authenticated;
revoke all on public.programs, public.profiles, public.student_records, public.courses,
  public.course_professors, public.evaluation_periods, public.student_enrollments,
  public.evaluation_criteria, public.evaluation_submissions, public.evaluation_ratings,
  public.evaluation_comments from anon;

create policy "Authenticated users can read programs"
  on public.programs for select to authenticated using (true);
create policy "Admins manage programs"
  on public.programs for all to authenticated
  using ((select private.user_has_role('admin')))
  with check ((select private.user_has_role('admin')));

create policy "Users can read their profile and professor names"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or role = 'professor' or (select private.user_has_role('admin')));

create policy "Students and admins can read student records"
  on public.student_records for select to authenticated
  using (student_id = (select auth.uid()) or (select private.user_has_role('admin')));
create policy "Admins manage student records"
  on public.student_records for all to authenticated
  using ((select private.user_has_role('admin')))
  with check ((select private.user_has_role('admin')));

create policy "Authenticated users can read courses"
  on public.courses for select to authenticated using (true);
create policy "Admins manage courses"
  on public.courses for all to authenticated
  using ((select private.user_has_role('admin')))
  with check ((select private.user_has_role('admin')));

create policy "Authenticated users can read course professor assignments"
  on public.course_professors for select to authenticated using (true);
create policy "Admins manage course professor assignments"
  on public.course_professors for all to authenticated
  using ((select private.user_has_role('admin')))
  with check ((select private.user_has_role('admin')));

create policy "Authenticated users can read evaluation periods"
  on public.evaluation_periods for select to authenticated using (true);
create policy "Admins manage evaluation periods"
  on public.evaluation_periods for all to authenticated
  using ((select private.user_has_role('admin')))
  with check ((select private.user_has_role('admin')));

create policy "Students see their enrollments and admins see all"
  on public.student_enrollments for select to authenticated
  using (student_id = (select auth.uid()) or (select private.user_has_role('admin')));
create policy "Admins manage enrollments"
  on public.student_enrollments for all to authenticated
  using ((select private.user_has_role('admin')))
  with check ((select private.user_has_role('admin')));

create policy "Authenticated users can read evaluation criteria"
  on public.evaluation_criteria for select to authenticated using (true);
create policy "Admins manage evaluation criteria"
  on public.evaluation_criteria for all to authenticated
  using ((select private.user_has_role('admin')))
  with check ((select private.user_has_role('admin')));

create policy "Students see their submissions and admins see all"
  on public.evaluation_submissions for select to authenticated
  using (student_id = (select auth.uid()) or (select private.user_has_role('admin')));

create policy "Students see their ratings and admins see all"
  on public.evaluation_ratings for select to authenticated
  using (
    (select private.user_has_role('admin'))
    or exists (
      select 1 from public.evaluation_submissions s
      where s.id = evaluation_ratings.submission_id and s.student_id = (select auth.uid())
    )
  );

create policy "Students and admins see comments; professors see assigned course comments"
  on public.evaluation_comments for select to authenticated
  using (
    (select private.user_has_role('admin'))
    or (select private.professor_teaches_course(course_id))
    or exists (
      select 1 from public.evaluation_submissions s
      where s.id = evaluation_comments.submission_id and s.student_id = (select auth.uid())
    )
  );

commit;

