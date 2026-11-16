begin;

update public.courses c
set program_id = p.id
from public.programs p
where p.name = 'General Education'
  and c.code = 'EGE10'
  and c.program_id is distinct from p.id;

commit;
