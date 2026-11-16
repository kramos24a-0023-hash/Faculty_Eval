begin;

insert into public.programs (name, department)
values ('General Education', 'General Education')
on conflict (name) do update set department = excluded.department;

update public.courses c
set program_id = p.id
from public.programs p
where p.name = 'General Education'
  and c.code in ('HMGE11', 'PATHFIT 3');

commit;
