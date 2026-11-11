begin;

alter table public.programs
  add column if not exists department text not null default 'Computing Studies';

create table if not exists public.instructors (
  id uuid primary key default gen_random_uuid(),
  full_name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.course_instructors (
  course_id uuid not null references public.courses(id) on delete cascade,
  instructor_id uuid not null references public.instructors(id) on delete cascade,
  primary key (course_id, instructor_id)
);

create index if not exists course_instructors_instructor_id_idx
  on public.course_instructors (instructor_id);

alter table public.instructors enable row level security;
alter table public.course_instructors enable row level security;

grant select on public.instructors, public.course_instructors to authenticated;
grant insert, update, delete on public.instructors, public.course_instructors to authenticated;

drop policy if exists "Authenticated users can read instructor directory" on public.instructors;
create policy "Authenticated users can read instructor directory"
  on public.instructors for select to authenticated using (true);
drop policy if exists "Admins manage instructor directory" on public.instructors;
create policy "Admins manage instructor directory"
  on public.instructors for all to authenticated
  using (private.user_has_role('admin'))
  with check (private.user_has_role('admin'));

drop policy if exists "Authenticated users can read course instructor assignments" on public.course_instructors;
create policy "Authenticated users can read course instructor assignments"
  on public.course_instructors for select to authenticated using (true);
drop policy if exists "Admins manage course instructor assignments" on public.course_instructors;
create policy "Admins manage course instructor assignments"
  on public.course_instructors for all to authenticated
  using (private.user_has_role('admin'))
  with check (private.user_has_role('admin'));

insert into public.programs (name, department)
values ('Computer Science', 'Computing Studies')
on conflict (name) do update set department = excluded.department;

insert into public.courses (program_id, code, name)
select p.id, c.code, c.name
from public.programs p
cross join (values
  ('CC104', 'Data Structures and Algorithms — LEC'),
  ('CC104L', 'Data Structures and Algorithms — LAB'),
  ('DS102', 'Discrete Structures 2'),
  ('EGE10', 'Science, Technology and Society'),
  ('HMGE11', 'Panitikan'),
  ('IM101', 'Fundamentals of Database Systems — LEC'),
  ('IM101L', 'Fundamentals of Database Systems — LAB'),
  ('PATHFIT 3', 'Dance'),
  ('SDF104', 'Object-Oriented Programming — LEC'),
  ('SDF104L', 'Object-Oriented Programming — LAB')
) as c(code, name)
where p.name = 'Computer Science'
on conflict (program_id, code) do update set name = excluded.name;

insert into public.instructors (full_name)
values
  ('Mr. Rame Tiongson'),
  ('Ms. Apasra Somo'),
  ('Ms. Fleur Rivera'),
  ('Ms. Anabelle Nase'),
  ('Ms. Ruby Cruz'),
  ('Mr. Xavier Pillas')
on conflict (full_name) do nothing;

insert into public.course_instructors (course_id, instructor_id)
select c.id, i.id
from public.courses c
join public.programs p on p.id = c.program_id and p.name = 'Computer Science'
join (values
  ('CC104', 'Mr. Rame Tiongson'),
  ('CC104L', 'Mr. Rame Tiongson'),
  ('DS102', 'Ms. Apasra Somo'),
  ('EGE10', 'Ms. Fleur Rivera'),
  ('HMGE11', 'Ms. Anabelle Nase'),
  ('IM101', 'Ms. Ruby Cruz'),
  ('IM101L', 'Ms. Ruby Cruz'),
  ('PATHFIT 3', 'Mr. Xavier Pillas'),
  ('SDF104', 'Mr. Rame Tiongson'),
  ('SDF104L', 'Mr. Rame Tiongson')
) as assignment(code, full_name) on assignment.code = c.code
join public.instructors i on i.full_name = assignment.full_name
on conflict (course_id, instructor_id) do nothing;

insert into public.evaluation_periods (name, school_year, semester, starts_at, ends_at, is_open)
select 'Midterm Faculty Evaluation', '2026–2027', '1st Semester',
  '2026-11-02 00:00:00+08:00', '2026-11-27 23:59:59+08:00', true
where not exists (
  select 1 from public.evaluation_periods
  where name = 'Midterm Faculty Evaluation'
    and school_year = '2026–2027'
    and semester = '1st Semester'
);

insert into public.evaluation_criteria (period_id, prompt, sort_order, is_active)
select ep.id, c.prompt, c.sort_order, true
from public.evaluation_periods ep
cross join (values
  (1, 'Explains course concepts clearly'),
  (2, 'Encourages questions and discussion'),
  (3, 'Provides useful feedback on student work'),
  (4, 'Uses class time and learning materials effectively'),
  (5, 'Treats students fairly and respectfully')
) as c(sort_order, prompt)
where ep.name = 'Midterm Faculty Evaluation'
  and ep.school_year = '2026–2027'
  and ep.semester = '1st Semester'
on conflict (period_id, sort_order) do update
  set prompt = excluded.prompt, is_active = true;

commit;
