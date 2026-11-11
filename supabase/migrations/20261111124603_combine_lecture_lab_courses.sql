begin;

-- Do not discard course evaluation history if this migration is applied later.
do $$
begin
  if exists (
    select 1
    from public.courses lab
    join public.evaluation_submissions s on s.course_id = lab.id
    where lab.code in ('CC104L', 'IM101L', 'SDF104L')
  ) then
    raise exception 'Cannot combine LAB courses because evaluations already exist for a LAB course';
  end if;
end;
$$;

-- Keep a single enrollment per student and evaluation period on the lecture course.
insert into public.student_enrollments (student_id, course_id, period_id)
select e.student_id, lecture.id, e.period_id
from public.student_enrollments e
join public.courses lab on lab.id = e.course_id
join public.courses lecture on lecture.program_id = lab.program_id
  and lecture.code = case lab.code
    when 'CC104L' then 'CC104'
    when 'IM101L' then 'IM101'
    when 'SDF104L' then 'SDF104'
  end
where lab.code in ('CC104L', 'IM101L', 'SDF104L')
on conflict (student_id, course_id, period_id) do nothing;

update public.courses
set name = case code
  when 'CC104' then 'Data Structures and Algorithms'
  when 'IM101' then 'Fundamentals of Database Systems'
  when 'SDF104' then 'Object-Oriented Programming'
  else name
end
where code in ('CC104', 'IM101', 'SDF104');

delete from public.student_enrollments e
using public.courses lab
where e.course_id = lab.id
  and lab.code in ('CC104L', 'IM101L', 'SDF104L');

delete from public.course_instructors ci
using public.courses lab
where ci.course_id = lab.id
  and lab.code in ('CC104L', 'IM101L', 'SDF104L');

delete from public.course_professors cp
using public.courses lab
where cp.course_id = lab.id
  and lab.code in ('CC104L', 'IM101L', 'SDF104L');

delete from public.courses
where code in ('CC104L', 'IM101L', 'SDF104L');

commit;
