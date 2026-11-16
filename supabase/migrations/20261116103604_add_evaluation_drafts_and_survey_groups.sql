begin;

alter table public.evaluation_criteria
  add column if not exists survey_group text not null default 'Teaching, learning, and assessment';

update public.evaluation_criteria c
set survey_group = case
  when c.sort_order between 1 and 11 then 'Professional responsibilities'
  when c.sort_order between 12 and 18 then 'Clarity, relevance, and engagement'
  when c.sort_order between 19 and 27 then 'Assessment and feedback'
  when c.sort_order between 28 and 35 then 'Inclusive learning and professional growth'
  else 'Participation and technology'
end
from public.evaluation_periods ep
where c.period_id = ep.id
  and ep.name = 'Midterm Faculty Evaluation'
  and ep.school_year = '2026–2027'
  and ep.semester = '1st Semester';

create table if not exists public.evaluation_drafts (
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  period_id uuid not null references public.evaluation_periods(id) on delete cascade,
  ratings jsonb not null default '[]'::jsonb check (jsonb_typeof(ratings) = 'array'),
  comment text check (comment is null or length(comment) <= 600),
  comment_anonymous boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (student_id, course_id, period_id)
);

alter table public.evaluation_drafts enable row level security;
revoke all on public.evaluation_drafts from anon;
grant select, insert, update, delete on public.evaluation_drafts to authenticated;

drop policy if exists "Students manage their own enrolled evaluation drafts" on public.evaluation_drafts;
create policy "Students manage their own enrolled evaluation drafts"
  on public.evaluation_drafts for all to authenticated
  using (
    student_id = (select auth.uid())
    and private.user_has_role('student')
    and exists (
      select 1 from public.student_enrollments e
      where e.student_id = (select auth.uid())
        and e.course_id = evaluation_drafts.course_id
        and e.period_id = evaluation_drafts.period_id
    )
  )
  with check (
    student_id = (select auth.uid())
    and private.user_has_role('student')
    and exists (
      select 1 from public.student_enrollments e
      where e.student_id = (select auth.uid())
        and e.course_id = evaluation_drafts.course_id
        and e.period_id = evaluation_drafts.period_id
    )
  );

commit;
