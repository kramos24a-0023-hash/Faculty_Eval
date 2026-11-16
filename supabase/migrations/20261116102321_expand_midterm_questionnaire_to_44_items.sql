begin;

-- The lettered statements in the source form are independent rating items.
-- Clear any responses to the interim 32-item form before replacing its items.
delete from public.evaluation_submissions s
using public.evaluation_periods ep
where s.period_id = ep.id
  and ep.name = 'Midterm Faculty Evaluation'
  and ep.school_year = '2026–2027'
  and ep.semester = '1st Semester';

delete from public.evaluation_criteria c
using public.evaluation_periods ep
where c.period_id = ep.id
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
  (12, 'Clarity of the instructor’s explanation and details as written in the course syllabus', 'Instructional Component (Teaching and Learning Process)'),
  (13, 'Provision of examples and real-life situations for better understanding', 'Instructional Component (Teaching and Learning Process)'),
  (14, 'Inclusion of trends and updates related to current events, developments, and emerging societal issues', 'Instructional Component (Teaching and Learning Process)'),
  (15, 'Relevance of course content and topics to actual, real-life situations', 'Instructional Component (Teaching and Learning Process)'),
  (16, 'Presentation of lessons in an interesting and organized manner', 'Instructional Component (Teaching and Learning Process)'),
  (17, 'Use of teaching or visual aids and materials whenever applicable and needed', 'Instructional Component (Teaching and Learning Process)'),
  (18, 'Enthusiasm of the instructor in carrying on a lively and engaging discussion', 'Instructional Component (Teaching and Learning Process)'),
  (19, 'Productivity of time spent in class', 'Instructional Component (Teaching and Learning Process)'),
  (20, 'Motivation that drives me to participate in class discussion or interaction', 'Instructional Component (Teaching and Learning Process)'),
  (21, 'The challenge I experience to think, analyze, and be creative in class', 'Instructional Component (Teaching and Learning Process)'),
  (22, 'Results of minor and major tests administered by my instructor or professor', 'Instructional Component (Teaching and Learning Process)'),
  (23, 'Justifiable grades for written outputs, projects, and recitations', 'Instructional Component (Teaching and Learning Process)'),
  (24, 'Issuance of periodic grades during grade consultations', 'Instructional Component (Teaching and Learning Process)'),
  (25, 'Verification of grades, when necessary, through the grading sheet', 'Instructional Component (Teaching and Learning Process)'),
  (26, 'Timely return of outputs such as quizzes, seatwork, task sheets, and other requirements', 'Instructional Component (Teaching and Learning Process)'),
  (27, 'My performance as reflected in the grades I earned', 'Instructional Component (Teaching and Learning Process)'),
  (28, 'Appropriateness and reasonability of course requirements', 'Instructional Component (Teaching and Learning Process)'),
  (29, 'Usefulness and importance of the things I learn in class', 'Instructional Component (Teaching and Learning Process)'),
  (30, 'Concern of my instructor or professor for my welfare', 'Instructional Component (Teaching and Learning Process)'),
  (31, 'Clarity of the instructor’s statement of lesson goals or intended learning outcomes at the beginning of the lesson', 'Instructional Component (Teaching and Learning Process)'),
  (32, 'Feeling of inclusion in class, considering different learning abilities, styles, and backgrounds', 'Instructional Component (Teaching and Learning Process)'),
  (33, 'Opportunity to ask questions or seek help, based on the instructor’s openness and availability for academic consultation', 'Instructional Component (Teaching and Learning Process)'),
  (34, 'Comfort and focus in class, based on classroom order, fair handling of misbehavior, and a respectful learning environment', 'Instructional Component (Teaching and Learning Process)'),
  (35, 'Development as a future professional, based on connections between lessons and my future field or real-life practice', 'Instructional Component (Teaching and Learning Process)'),
  (36, 'Encouraging student-led topic discussions or presentations', 'Instructional Component (Teaching and Learning Process)'),
  (37, 'Allowing students to develop their own strategies in presenting lessons', 'Instructional Component (Teaching and Learning Process)'),
  (38, 'Building students’ self-confidence and articulation skills', 'Instructional Component (Teaching and Learning Process)'),
  (39, 'Promoting creativity, critical thinking, and resourcefulness', 'Instructional Component (Teaching and Learning Process)'),
  (40, 'Use of technology to adapt instructional activities to my needs', 'Instructional Component (Teaching and Learning Process)'),
  (41, 'Use of online tools, software, or references when the instructor creates and administers tests and assessments', 'Instructional Component (Teaching and Learning Process)'),
  (42, 'Use of technological representations, such as multimedia, visual demonstrations, or video clips, to demonstrate subject content', 'Instructional Component (Teaching and Learning Process)'),
  (43, 'Use of varied technologies to facilitate diverse teaching and learning activities', 'Instructional Component (Teaching and Learning Process)'),
  (44, 'Use of technology to facilitate cooperative learning experiences', 'Instructional Component (Teaching and Learning Process)')
) as q(sort_order, prompt, section)
where ep.name = 'Midterm Faculty Evaluation'
  and ep.school_year = '2026–2027'
  and ep.semester = '1st Semester';

commit;
