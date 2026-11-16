insert into public.programs (name, department)
values ('Associate in Computer Technology', 'Computing Studies')
on conflict (name) do update set department = excluded.department;
