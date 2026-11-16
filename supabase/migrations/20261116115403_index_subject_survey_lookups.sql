create index if not exists evaluation_criteria_course_id_idx
  on public.evaluation_criteria (course_id);

create index if not exists evaluation_ratings_criterion_id_idx
  on public.evaluation_ratings (criterion_id);
