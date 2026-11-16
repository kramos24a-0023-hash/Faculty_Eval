begin;

alter table public.evaluation_criteria
  add column if not exists section text not null default 'Instructional Component';

-- Reset this open cycle so the existing five-question response cannot be
-- mistaken for results from the replacement questionnaire. The submission
-- delete cascades only to its ratings and optional comment.
delete from public.evaluation_submissions s
using public.evaluation_periods ep
where s.period_id = ep.id
  and ep.name = 'Midterm Faculty Evaluation'
  and ep.school_year = '2026–2027'
  and ep.semester = '1st Semester';

insert into public.evaluation_criteria (period_id, prompt, section, sort_order, is_active)
select ep.id, q.prompt, q.section, q.sort_order, true
from public.evaluation_periods ep
cross join (values
  (1, 'Issuance and proper discussion of the course syllabus during the first week of the semester', 'Non-Instructional Component (Professional Responsibilities & Conduct)'),
  (2, 'Discussion of classroom house rules during the first week of the semester', 'Non-Instructional Component (Professional Responsibilities & Conduct)'),
  (3, 'Thorough explanation of the contents and topics of the courseware', 'Non-Instructional Component (Professional Responsibilities & Conduct)'),
  (4, 'Explanation of the grading system during the first week of classes', 'Non-Instructional Component (Professional Responsibilities & Conduct)'),
  (5, 'Proper administration of periodic examinations with guidance and care for students', 'Non-Instructional Component (Professional Responsibilities & Conduct)'),
  (6, 'Reporting to class regularly', 'Non-Instructional Component (Professional Responsibilities & Conduct)'),
  (7, 'Regular checking of attendance', 'Non-Instructional Component (Professional Responsibilities & Conduct)'),
  (8, 'Propriety and professional decorum in speech and action', 'Non-Instructional Component (Professional Responsibilities & Conduct)'),
  (9, 'Personal grooming, neatness, and composure', 'Non-Instructional Component (Professional Responsibilities & Conduct)'),
  (10, 'Starting and finishing the class on time', 'Non-Instructional Component (Professional Responsibilities & Conduct)'),
  (11, 'Demonstration of fairness, impartiality, and confidentiality in dealing with students', 'Non-Instructional Component (Professional Responsibilities & Conduct)'),
  (12, 'My understanding of the topic discussed was based on: clarity of explanations and details in the course syllabus; examples and real-life situations; current trends and emerging issues; and relevance to real life', 'Instructional Component (Teaching and Learning Process)'),
  (13, 'My interest and attention were influenced by: an interesting and organized lesson; use of teaching or visual aids when needed; and the instructor’s enthusiasm and engaging discussion', 'Instructional Component (Teaching and Learning Process)'),
  (14, 'Productivity of time spent in class', 'Instructional Component (Teaching and Learning Process)'),
  (15, 'Motivation that drives me to participate in class discussion or interaction', 'Instructional Component (Teaching and Learning Process)'),
  (16, 'The challenge I experience to think, analyze, and be creative in class', 'Instructional Component (Teaching and Learning Process)'),
  (17, 'My class standing was based on: test results; justifiable grades for outputs, projects, and recitations; periodic grade consultation; grade verification when needed; and timely return of student work', 'Instructional Component (Teaching and Learning Process)'),
  (18, 'My performance as reflected in the grades I earned', 'Instructional Component (Teaching and Learning Process)'),
  (19, 'Appropriateness and reasonability of course requirements', 'Instructional Component (Teaching and Learning Process)'),
  (20, 'Usefulness and importance of the things I learn in class', 'Instructional Component (Teaching and Learning Process)'),
  (21, 'Concern of my instructor or professor for my welfare', 'Instructional Component (Teaching and Learning Process)'),
  (22, 'Understanding of lesson objectives, based on how clearly the instructor states intended learning outcomes at the beginning of the lesson', 'Instructional Component (Teaching and Learning Process)'),
  (23, 'Feeling of inclusion in class, considering different learning abilities, styles, and backgrounds', 'Instructional Component (Teaching and Learning Process)'),
  (24, 'Opportunity to ask questions or seek help, based on the instructor’s openness and availability for academic consultation', 'Instructional Component (Teaching and Learning Process)'),
  (25, 'Comfort and focus in class, based on classroom order, fair handling of misbehavior, and a respectful learning environment', 'Instructional Component (Teaching and Learning Process)'),
  (26, 'Development as a future professional, based on connections between lessons and my future field or real-life practice', 'Instructional Component (Teaching and Learning Process)'),
  (27, 'Student participation and creativity through student-led discussions or presentations, student-developed presentation strategies, confidence and articulation, and creativity and critical thinking', 'Instructional Component (Teaching and Learning Process)'),
  (28, 'Use of technology to adapt instructional activities to my needs', 'Instructional Component (Teaching and Learning Process)'),
  (29, 'Use of online tools, software, or references when the instructor creates and administers tests and assessments', 'Instructional Component (Teaching and Learning Process)'),
  (30, 'Use of technological representations such as multimedia, visual demonstrations, or video clips to demonstrate subject content', 'Instructional Component (Teaching and Learning Process)'),
  (31, 'Use of varied technologies to facilitate diverse teaching and learning activities', 'Instructional Component (Teaching and Learning Process)'),
  (32, 'Use of technology to facilitate cooperative learning experiences', 'Instructional Component (Teaching and Learning Process)')
) as q(sort_order, prompt, section)
where ep.name = 'Midterm Faculty Evaluation'
  and ep.school_year = '2026–2027'
  and ep.semester = '1st Semester'
on conflict (period_id, sort_order) do update
  set prompt = excluded.prompt,
      section = excluded.section,
      is_active = true;

update public.evaluation_criteria c
set is_active = false
from public.evaluation_periods ep
where c.period_id = ep.id
  and ep.name = 'Midterm Faculty Evaluation'
  and ep.school_year = '2026–2027'
  and ep.semester = '1st Semester'
  and c.sort_order > 32;

commit;
