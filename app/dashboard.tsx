"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "../lib/supabase/client";
import QuestionnaireManager from "./questionnaire-manager";

type Page = "Overview" | "Evaluation periods" | "Subject questionnaires" | "Teachers" | "Students" | "Faculty results";
type Teacher = { id: string; name: string; role: string; program: string; yearLevel: string; course: string; initials: string; evaluations: number };
type Period = { id: string; name: string; semester: string; schoolYear: string; start: string; end: string; status: "Active" | "Upcoming" | "Closed" };
type ProgramStats = { name: string; code: string; eligible: number; submitted: number };
type TeacherQuestionScore = { prompt: string; section: string; course: string; average: number | null; responses: number };
type TeacherSubjectScore = { course: string; average: number; totalPoints: number; possiblePoints: number; responses: number };
type TeacherComment = { body: string; commenter: string; course: string; createdAt: string };
type TeacherRanking = { name: string; average: number; totalPoints: number; possiblePoints: number; responses: number; subjectGrades: TeacherSubjectScore[]; questions: TeacherQuestionScore[]; comments: TeacherComment[] };
type StudentRosterCourse = { id: string; code: string; name: string; label: string };
type StudentProgram = { id: string; name: string; department: string };
type StudentRosterRow = { id: string; name: string; schoolId: string; department: string; program: string; yearLevel: string; courses: StudentRosterCourse[] };

const navigation: { title: string; icon: string; group: string }[] = [
  { title: "Overview", icon: "⌂", group: "Workspace" },
  { title: "Evaluation periods", icon: "◷", group: "Workspace" },
  { title: "Subject questionnaires", icon: "☷", group: "Evaluation" },
  { title: "Teachers", icon: "♙", group: "Management" },
  { title: "Students", icon: "♧", group: "Management" },
  { title: "Faculty results", icon: "▥", group: "Insights" },
];

async function loadAllRows(query: any) {
  const pageSize = 500;
  const rows: any[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) return { data: null, error };
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return { data: rows, error: null };
}

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function dateParts(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return {
    day: date.toLocaleDateString("en-US", { day: "2-digit" }),
    month: date.toLocaleDateString("en-US", { month: "short" }),
  };
}

function Progress({ value, light = false }: { value: number; light?: boolean }) {
  return (
    <span className={`progress ${light ? "progress--light" : ""}`} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${value}%` }} />
    </span>
  );
}

export default function Dashboard({ onLogout, adminName = "Maria Clara" }: { onLogout?: () => void; adminName?: string }) {
  const [page, setPage] = useState<Page>("Overview");
  const [periods, setPeriods] = useState<Period[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [teacherRankings, setTeacherRankings] = useState<TeacherRanking[]>([]);
  const [programStats, setProgramStats] = useState<ProgramStats[]>([]);
  const [studentRoster, setStudentRoster] = useState<StudentRosterRow[]>([]);
  const [studentPrograms, setStudentPrograms] = useState<StudentProgram[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [selectedRankedTeacher, setSelectedRankedTeacher] = useState("");
  const [teacherDetailsHidden, setTeacherDetailsHidden] = useState(false);
  const [dataError, setDataError] = useState("");
  const [totalStudents, setTotalStudents] = useState(0);
  const [activeQuestionCount, setActiveQuestionCount] = useState(0);
  const [activeQuestionSectionCount, setActiveQuestionSectionCount] = useState(0);
  const [totalEligibleEnrollments, setTotalEligibleEnrollments] = useState(0);
  const [submitted, setSubmitted] = useState(0);
  const [loading, setLoading] = useState(true);
  const [periodDialog, setPeriodDialog] = useState(false);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const totalEligible = totalStudents;
  const nameParts = adminName.trim().split(/\s+/).filter((part) => part.length > 1);
  const adminInitials = nameParts.length > 1 ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase() : (nameParts[0] ?? "A").slice(0, 2).toUpperCase();
  const firstName = adminName.trim().split(/\s+/)[0] || adminName;
  const participation = totalEligibleEnrollments ? Math.min(100, Math.round((submitted / totalEligibleEnrollments) * 1000) / 10) : 0;
  const filteredTeachers = teachers.filter((teacher) => `${teacher.name} ${teacher.program} ${teacher.yearLevel} ${teacher.course}`.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    let active = true;
    async function loadDashboard() {
      const db = createClient();
      const [periodResult, courseResult, instructorResult, professorResult, studentProfileResult, studentResult, enrollmentResult, submissionResult, criteriaResult, ratingResult, commentResult, studentProgramResult] = await Promise.all([
        loadAllRows(db.from("evaluation_periods").select("id,name,semester,school_year,starts_at,ends_at,is_open").order("starts_at", { ascending: false }).order("id")),
        loadAllRows(db.from("courses").select("id,code,name,program_id,programs(name,department)").order("id")),
        loadAllRows(db.from("course_instructors").select("course_id,instructors(full_name)").order("course_id").order("instructor_id")),
        loadAllRows(db.from("course_professors").select("course_id,profiles(full_name,role)").order("course_id").order("professor_id")),
        loadAllRows(db.from("profiles").select("id,full_name").eq("role", "student").order("full_name").order("id")),
        loadAllRows(db.from("student_records").select("student_id,school_student_id,year_level,program_id,programs(name,department)").order("student_id")),
        loadAllRows(db.from("student_enrollments").select("student_id,course_id,period_id").order("student_id").order("course_id").order("period_id")),
        loadAllRows(db.from("evaluation_submissions").select("id,student_id,course_id,period_id").order("id")),
        loadAllRows(db.from("evaluation_criteria").select("id,course_id,prompt,section,sort_order,period_id,is_active").order("sort_order").order("id")),
        loadAllRows(db.from("evaluation_ratings").select("submission_id,criterion_id,rating").order("submission_id").order("criterion_id")),
        loadAllRows(db.from("evaluation_comments").select("id,body,professor_visible_name,course_id,period_id,created_at").order("created_at").order("id")),
        loadAllRows(db.from("programs").select("id,name,department").order("department").order("name")),
      ]);
      const failed = [periodResult, courseResult, instructorResult, professorResult, studentProfileResult, studentResult, enrollmentResult, submissionResult, criteriaResult, ratingResult, commentResult, studentProgramResult].find((result) => result.error);
      if (failed?.error) { if (active) { setDataError(`Could not load admin data: ${failed.error.message}`); setLoading(false); } return; }
      if (!active) return;
      const periodsData = periodResult.data ?? [];
      const now = Date.now();
      const mappedPeriods: Period[] = periodsData.map((p: any) => ({ id: p.id, name: p.name, semester: p.semester, schoolYear: p.school_year, start: p.starts_at.slice(0,10), end: p.ends_at.slice(0,10), status: p.is_open && Date.parse(p.starts_at) <= now && Date.parse(p.ends_at) >= now ? "Active" : Date.parse(p.starts_at) > now ? "Upcoming" : "Closed" }));
      setPeriods(mappedPeriods);
      const activePeriodId = (selectedPeriodId && mappedPeriods.some((p) => p.id === selectedPeriodId) ? selectedPeriodId : mappedPeriods.find((p) => p.status === "Active")?.id) ?? mappedPeriods[0]?.id ?? "";
      setSelectedPeriodId(activePeriodId);
      const students = studentResult.data ?? [];
      setStudentPrograms(studentProgramResult.data ?? []);
      const enrollments = (enrollmentResult.data ?? []).filter((e: any) => e.period_id === activePeriodId);
      const submissions = (submissionResult.data ?? []).filter((s: any) => s.period_id === activePeriodId);
      const courses = courseResult.data ?? [];
      const recordsByStudent = new Map((studentResult.data ?? []).map((record: any) => [record.student_id, record]));
      const coursesByIdForRoster = new Map((courses as any[]).map((course: any) => [course.id, course]));
      const coursesByStudent = new Map<string, StudentRosterCourse[]>();
      for (const enrollment of enrollments as any[]) {
        const course: any = coursesByIdForRoster.get(enrollment.course_id);
        if (!course) continue;
        const enrolledCourses = coursesByStudent.get(enrollment.student_id) ?? [];
        if (!enrolledCourses.some((item) => item.id === course.id)) enrolledCourses.push({ id: course.id, code: course.code, name: course.name, label: `${course.code} · ${course.name}` });
        coursesByStudent.set(enrollment.student_id, enrolledCourses);
      }
      setStudentRoster((studentProfileResult.data ?? []).map((profile: any) => {
        const record: any = recordsByStudent.get(profile.id);
        const linkedProgram = Array.isArray(record?.programs) ? record.programs[0] : record?.programs;
        return {
          id: profile.id,
          name: profile.full_name || "Name not set",
          schoolId: record?.school_student_id || "Not linked",
          department: linkedProgram?.department || "Program not assigned",
          program: linkedProgram?.name || "Program not assigned",
          yearLevel: record?.year_level || "Not set",
          courses: coursesByStudent.get(profile.id) ?? [],
        };
      }));
      setTotalStudents(new Set(enrollments.map((e: any) => e.student_id)).size);
      setTotalEligibleEnrollments(enrollments.length);
      setSubmitted(submissions.length);
      const stats = new Map<string, ProgramStats>();
      for (const e of enrollments as any[]) {
          const student: any = students.find((s: any) => s.student_id === e.student_id);
        const course: any = courses.find((c: any) => c.id === e.course_id);
        const program = Array.isArray(course?.programs) ? course.programs[0] : course?.programs;
        if (!program) continue;
        const key = `${program.department ?? ""}|${program.name}`;
        const row = stats.get(key) ?? { name: [program.department, program.name].filter(Boolean).join(" · "), code: program.name, eligible: 0, submitted: 0 };
        row.eligible++;
        if (submissions.some((s: any) => s.student_id === e.student_id && s.course_id === e.course_id && s.period_id === e.period_id)) row.submitted++;
        stats.set(key, row);
      }
      setProgramStats([...stats.values()]);
      const instructorNames = new Map<string, string[]>();
      for (const item of instructorResult.data ?? [] as any[]) { const x: any = item; const value = Array.isArray(x.instructors) ? x.instructors[0] : x.instructors; if (value?.full_name) instructorNames.set(x.course_id, [...(instructorNames.get(x.course_id) ?? []), value.full_name]); }
      for (const item of professorResult.data ?? [] as any[]) { const x: any = item; const value = Array.isArray(x.profiles) ? x.profiles[0] : x.profiles; if (value?.full_name) instructorNames.set(x.course_id, [...(instructorNames.get(x.course_id) ?? []), value.full_name]); }
      const grouped = new Map<string, Teacher>();
      for (const course of courses as any[]) {
        const program = Array.isArray(course.programs) ? course.programs[0] : course.programs;
        const programLabel = [...new Set([program?.department, program?.name].filter(Boolean))].join(" · ") || "Program not assigned";
        for (const teacherName of new Set(instructorNames.get(course.id) ?? [])) {
          const matchedEnrollments = enrollments.filter((e: any) => e.course_id === course.id);
          const byYear = new Map<string, string[]>();
          for (const enrollment of matchedEnrollments) {
            const record: any = students.find((s: any) => s.student_id === enrollment.student_id);
            const year = record?.year_level?.trim() || "Year level not set";
            byYear.set(year, [...(byYear.get(year) ?? []), enrollment.student_id]);
          }
          if (byYear.size === 0) byYear.set("No students enrolled", []);
          for (const [year, eligibleIds] of byYear) {
            const eligible = eligibleIds.length;
            const responseIds = new Set(submissions.filter((s: any) => s.course_id === course.id).map((s: any) => s.student_id));
            const responses = eligibleIds.filter((id) => responseIds.has(id)).length;
            const key = `${teacherName}|${programLabel}|${year}|${course.id}`;
            grouped.set(key, { id: key, name: teacherName, role: "Faculty", program: programLabel, yearLevel: year, course: `${course.code} · ${course.name}`, initials: teacherName.split(/\s+/).slice(0,2).map((p: string)=>p[0]).join("").toUpperCase(), evaluations: eligible ? Math.round(responses / eligible * 100) : 0 });
          }
        }
      }
      setTeachers([...grouped.values()]);
      const periodSubmissions = (submissionResult.data ?? []).filter((s: any) => s.period_id === activePeriodId);
      const submissionIds = new Set(periodSubmissions.map((s: any) => s.id));
      const periodCriteria = (criteriaResult.data ?? []).filter((item: any) => item.period_id === activePeriodId);
      const activeCriteria = (criteriaResult.data ?? []).filter((item: any) => item.period_id === activePeriodId && item.is_active);
      const subjectSurveyCourseIds = new Set(activeCriteria.map((item: any) => item.course_id).filter(Boolean));
      const courseSpecificCriteria = activeCriteria.filter((item: any) => item.course_id);
      const standardCriteria = activeCriteria.filter((item: any) => !item.course_id);
      const usesStandardSurvey = (courses as any[]).some((course: any) => !subjectSurveyCourseIds.has(course.id));
      const effectiveCriteria = [...courseSpecificCriteria, ...(usesStandardSurvey ? standardCriteria : [])];
      setActiveQuestionCount(effectiveCriteria.length);
      setActiveQuestionSectionCount(new Set(effectiveCriteria.map((item: any) => item.section).filter(Boolean)).size);
      const periodRatings = (ratingResult.data ?? []).filter((item: any) => submissionIds.has(item.submission_id));
      const coursesById = new Map((courses as any[]).map((course: any) => [course.id, course]));
      const rankingByTeacher = new Map<string, { total: number; ratingCount: number; responses: Set<string>; perQuestion: Map<string, number[]>; comments: TeacherComment[]; byCourse: Map<string, { scoreTotal: number; rawTotalPoints: number; ratingCount: number; responses: number }> }>();
      const ratingsBySubmission = new Map<string, any[]>();
      for (const rating of periodRatings as any[]) ratingsBySubmission.set(rating.submission_id, [...(ratingsBySubmission.get(rating.submission_id) ?? []), rating]);
      const peopleByCourse = new Map<string, string[]>();
      for (const [courseId, names] of instructorNames) peopleByCourse.set(courseId, [...new Set(names)]);
      for (const submission of periodSubmissions as any[]) {
        const names = peopleByCourse.get(submission.course_id) ?? [];
        const responseRatings = ratingsBySubmission.get(submission.id) ?? [];
        for (const name of names) {
          const entry = rankingByTeacher.get(name) ?? { total: 0, ratingCount: 0, responses: new Set<string>(), perQuestion: new Map<string, number[]>(), comments: [], byCourse: new Map<string, { scoreTotal: number; rawTotalPoints: number; ratingCount: number; responses: number }>() };
          entry.responses.add(submission.id);
          const courseScore = entry.byCourse.get(submission.course_id) ?? { scoreTotal: 0, rawTotalPoints: 0, ratingCount: 0, responses: 0 };
          if (responseRatings.length) {
            courseScore.scoreTotal += responseRatings.reduce((sum, rating) => sum + Number(rating.rating), 0) / responseRatings.length;
            courseScore.responses++;
          }
          for (const rating of responseRatings) {
            entry.total += Number(rating.rating);
            entry.ratingCount++;
            courseScore.rawTotalPoints += Number(rating.rating);
            courseScore.ratingCount++;
            const questionKey = `${submission.course_id}::${rating.criterion_id}`;
            entry.perQuestion.set(questionKey, [...(entry.perQuestion.get(questionKey) ?? []), Number(rating.rating)]);
          }
          entry.byCourse.set(submission.course_id, courseScore);
          rankingByTeacher.set(name, entry);
        }
      }
      for (const comment of (commentResult.data ?? []).filter((row: any) => row.period_id === activePeriodId) as any[]) {
        const course: any = coursesById.get(comment.course_id);
        const courseLabel = course ? `${course.code} · ${course.name}` : "Course";
        for (const name of peopleByCourse.get(comment.course_id) ?? []) {
          const entry = rankingByTeacher.get(name);
          if (entry) entry.comments.push({ body: comment.body, commenter: comment.professor_visible_name ?? "Anonymous student", course: courseLabel, createdAt: comment.created_at });
        }
      }
      const computedRankings: TeacherRanking[] = [...rankingByTeacher.entries()]
        .filter(([, entry]) => entry.ratingCount > 0)
        .map(([name, entry]) => ({
          name,
          average: [...entry.byCourse.values()].filter((score) => score.responses > 0).reduce((sum, score) => sum + score.scoreTotal / score.responses, 0) / [...entry.byCourse.values()].filter((score) => score.responses > 0).length,
          totalPoints: entry.total,
          possiblePoints: entry.ratingCount * 5,
          responses: entry.responses.size,
          subjectGrades: [...entry.byCourse.entries()].flatMap(([courseId, score]) => {
            const course: any = coursesById.get(courseId);
            return score.responses ? [{ course: `${course?.code ?? ""} · ${course?.name ?? "Course"}`, average: score.scoreTotal / score.responses, totalPoints: score.rawTotalPoints, possiblePoints: score.ratingCount * 5, responses: score.responses }] : [];
          }),
          questions: [...entry.byCourse.keys()].flatMap((courseId) => {
            const course: any = coursesById.get(courseId);
            const courseLabel = course ? `${course.code} · ${course.name}` : "Course";
            const customSurvey = activeCriteria.filter((criterion: any) => criterion.course_id === courseId);
            const effectiveSurvey = customSurvey.length ? customSurvey : activeCriteria.filter((criterion: any) => !criterion.course_id);
            const effectiveIds = new Set(effectiveSurvey.map((criterion: any) => criterion.id));
            const historicalIds = [...entry.perQuestion.keys()].flatMap((key) => {
              const [ratedCourseId, criterionId] = key.split("::");
              return ratedCourseId === courseId && !effectiveIds.has(criterionId) ? [criterionId] : [];
            });
            const criteriaById = new Map(periodCriteria.map((criterion: any) => [criterion.id, criterion]));
            const questionIds = [...new Set([...effectiveSurvey.map((criterion: any) => criterion.id), ...historicalIds])];
            return questionIds.flatMap((criterionId) => {
              const criterion: any = criteriaById.get(criterionId);
              if (!criterion) return [];
              const values = entry.perQuestion.get(`${courseId}::${criterionId}`) ?? [];
              return [{ prompt: criterion.prompt, section: criterion.section ?? "", course: `${courseLabel}${effectiveIds.has(criterionId) ? " · Active survey" : " · Earlier survey"}`, average: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null, responses: values.length }];
            });
          }),
          comments: entry.comments.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        }))
        .sort((a, b) => b.average - a.average || b.responses - a.responses || a.name.localeCompare(b.name));
      setTeacherRankings(computedRankings);
      setDataError(""); setLoading(false);
    }
    void loadDashboard();
    return () => { active = false; };
  }, [selectedPeriodId]);

  function createPeriod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const start = String(data.get("start") ?? "");
    const end = String(data.get("end") ?? "");
    if (end < start) {
      setToast("The end date must be after the start date.");
      return;
    }
    const name = String(data.get("name") ?? "New evaluation period").trim();
    const semester = String(data.get("semester") ?? "1st Semester");
    const schoolYear = String(data.get("schoolYear") ?? "2026–2027");
    void createClient().from("evaluation_periods").insert({ name, semester, school_year: schoolYear, starts_at: new Date(`${start}T00:00:00`).toISOString(), ends_at: new Date(`${end}T23:59:59`).toISOString(), is_open: false }).select("id,name,semester,school_year,starts_at,ends_at,is_open").single().then(({ data, error }) => {
      if (error) { setToast(`Could not create period: ${error.message}`); return; }
      setPeriods((items) => [...items, { id: data.id, name: data.name, semester: data.semester, schoolYear: data.school_year, start: data.starts_at.slice(0,10), end: data.ends_at.slice(0,10), status: "Upcoming" }]);
      setPeriodDialog(false); setToast("Evaluation period saved."); event.currentTarget.reset();
    });
  }

  function changePage(nextPage: string) {
    setPage(nextPage as Page);
    setMobileNavOpen(false);
    setSearch("");
  }

  function selectRankedTeacher(name: string) {
    setSelectedRankedTeacher(name);
    setTeacherDetailsHidden(false);
  }

  return (
    <div className="app-shell admin-shell">
      <aside className={`sidebar ${mobileNavOpen ? "is-open" : ""}`}>
        <a className="brand" href="#overview" onClick={(event) => { event.preventDefault(); changePage("Overview"); }}>
          <span className="brand__top"><img className="brand__logo" src="/olopsc-bmse-logo.webp" alt="" /><span className="brand__identity"><strong>OLOPSC</strong><small>FACULTY EVALUATION SYSTEM</small></span></span>
          <span className="brand__college">Our Lady Of Perpetual Succor College of Business Management, Science and Education</span>
        </a>
        <div className="workspace-switch"><span className="workspace-switch__icon">◈</span><span><strong>Admin workspace</strong><small>Institution management</small></span><span className="muted">⌄</span></div>
        <nav className="primary-nav" aria-label="Main navigation">
          {["Workspace", "Evaluation", "Management", "Insights"].map((group) => (
            <div className="nav-group" key={group}>
              <p className="nav-label">{group}</p>
              {navigation.filter((item) => item.group === group).map((item) => (
                <button key={item.title} className={`nav-item ${page === item.title ? "is-active" : ""}`} type="button" onClick={() => changePage(item.title)} aria-current={page === item.title ? "page" : undefined}>
                  <span className="nav-item__icon" aria-hidden="true">{item.icon}</span>{item.title}
                  {item.title === "Evaluation periods" && <span className="nav-badge">{periods.filter((period) => period.status === "Active").length}</span>}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar__bottom">
          <div className="help-card"><span className="help-card__icon">?</span><span><strong>Need a hand?</strong><small>Help for your workspace</small></span><span className="muted">↗</span></div>
          <div className="user-profile"><span className="avatar avatar--sidebar">{adminInitials}</span><span><strong>{adminName}</strong><small>System admin</small></span><button className="icon-button icon-button--sidebar" type="button" aria-label="Log out" title="Log out" onClick={() => onLogout?.()}>↪</button></div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu" type="button" aria-label="Toggle navigation" aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen((open) => !open)}>☰</button>
          <div className="breadcrumb"><span>Workspace</span><span aria-hidden="true">/</span><strong>{page}</strong></div>
          <div className="top-actions">
            <label className="search-box"><span className="search-box__icon">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search teachers, courses..." aria-label="Search teachers and courses" /><kbd>Ctrl K</kbd></label>
            <button className="icon-button notification-button" type="button" aria-label="Notifications" onClick={() => setToast("You’re all caught up on notifications.")}>♧<span className="notification-button__dot" /></button>
            <span className="avatar" aria-label={adminName}>{adminInitials}</span>
          </div>
        </header>

        <div className="content">
          {page === "Overview" && <>
            <section className="page-heading">
              <div><p className="eyebrow"><span className="eyebrow__dot" /> {periods.find((period) => period.id === selectedPeriodId)?.schoolYear ?? "SCHOOL EVALUATIONS"} <span>·</span> {periods.find((period) => period.id === selectedPeriodId)?.semester ?? "ALL PERIODS"}</p><h1>Good morning, {firstName} <span className="heading__spark">✳</span></h1><p className="page-heading__description">{periods.find((period) => period.id === selectedPeriodId)?.name ?? "A live view of participation and faculty feedback across OLOPSC."}</p></div>
              <button className="button button--primary" type="button" onClick={() => setPeriodDialog(true)}>＋ <span>New evaluation period</span></button>
            </section>
            <section className="metric-grid" aria-label="Evaluation overview">
              <Metric title="Faculty assignments" value={String(teachers.length)} icon="♙" note="From assigned course roster" trend="Live data" />
              <Metric title="Eligible students" value={totalEligible.toLocaleString()} icon="♧" note="Students enrolled for periods" trend="Live data" />
              <article className="metric-card"><div className="metric-card__top"><span>Submissions received</span><span className="metric-icon">✓</span></div><p className="metric-card__value">{submitted.toLocaleString()} <span className="metric-card__total">/ {totalEligibleEnrollments.toLocaleString()} eligible evaluations</span></p><Progress value={participation} light /><div className="metric-card__footer"><span>{participation}% participation</span><span className="trend">{loading ? "Loading" : "Live data"}</span></div></article>
              <Metric title="Participation target" value="90%" icon="◎" note={`${Math.max(0, Math.ceil(totalEligible * 0.9 - submitted)).toLocaleString()} more submissions to reach target`} trend="School goal" />
            </section>
            <section className="overview-grid">
              <article className="panel periods-panel"><div className="panel-heading"><div><h2>Evaluation periods</h2><p>Active and upcoming school evaluation cycles</p></div><button className="text-link" onClick={() => changePage("Evaluation periods")}>View all <span>→</span></button></div>
                {periods.slice(0, 2).map((period, index) => <PeriodRow key={period.id} period={period} activeProgress={index === 0 ? participation : undefined} onClick={() => changePage("Evaluation periods")} />)}
              </article>
              <article className="panel activity-panel"><div className="panel-heading"><div><h2>Current evaluation activity</h2><p>Live details for the selected period</p></div><span className="live-indicator"><i /> Live</span></div><div className="activity-list"><Activity icon="♙" title="Faculty roster" detail={`${teachers.length} faculty assignments across ${programStats.length} programs`} time="Selected period" /><Activity icon="✓" tone="green" title={periods.find((period) => period.id === selectedPeriodId)?.name ?? "Evaluation period"} detail={`${submitted} of ${totalEligibleEnrollments} course evaluations submitted`} time={periods.find((period) => period.id === selectedPeriodId)?.status ?? "Current"} /><Activity icon="▣" tone="gold" title="Survey questionnaire" detail={`${activeQuestionCount} items across ${activeQuestionSectionCount} sections`} time="Selected period" /></div></article>
            </section>
            <ProgramTable programs={programStats} />
            <section className="quick-actions"><strong>Quick actions</strong><button onClick={() => changePage("Teachers")}>♙ &nbsp;Browse teachers <span className="quick-actions__plus">→</span></button><button onClick={() => setPeriodDialog(true)}>◷ &nbsp;Open a new period <span className="quick-actions__plus">＋</span></button></section>
          </>}

          {page === "Evaluation periods" && <section className="subpage"><div className="page-heading"><div><p className="eyebrow"><span className="eyebrow__dot" /> ACADEMIC YEAR 2026–2027</p><h1>Evaluation periods</h1><p className="page-heading__description">Plan and monitor the feedback cycles for your school.</p></div><button className="button button--primary" onClick={() => setPeriodDialog(true)}>＋ <span>New evaluation period</span></button></div><div className="periods-list">{periods.map((period, index) => <article className="panel period-card" key={period.id}><div className={`period-card__calendar ${period.status === "Active" ? "period-card__calendar--active" : ""}`}><strong>{dateParts(period.start).day}</strong><span>{dateParts(period.start).month.toUpperCase()}</span></div><div className="period-card__main"><div className="period-row__title"><h2>{period.name}</h2><span className={`status ${period.status === "Active" ? "status--active" : "status--upcoming"}`}>{period.status}</span></div><p>{period.semester} · AY {period.schoolYear} · All academic programs</p><small>{formatDate(period.start)} – {formatDate(period.end)}, {period.schoolYear.split("–")[0]}</small>{index === 0 && <><div className="progress-caption"><span>Student participation</span><strong>{participation}%</strong></div><Progress value={participation} /></>}</div><button className="row-action" type="button" aria-label={`Open ${period.name}`} onClick={() => setToast(`${period.name} details selected.`)}>›</button></article>)}</div></section>}

          {page === "Subject questionnaires" && <QuestionnaireManager />}

          {page === "Teachers" && <section className="subpage"><div className="page-heading"><div><p className="eyebrow"><span className="eyebrow__dot" /> SCHOOL DIRECTORY</p><h1>Teachers</h1><p className="page-heading__description">Faculty assignments grouped by course and enrolled student year level.</p></div></div><DirectoryTable search={search} teachers={teachers} onViewResults={(name) => { selectRankedTeacher(name); changePage("Faculty results"); }} /></section>}

          {page === "Students" && <section className="subpage"><div className="page-heading"><div><p className="eyebrow"><span className="eyebrow__dot" /> SCHOOL DIRECTORY</p><h1>Students</h1><p className="page-heading__description">Browse department → program → year level → student, with each student’s assigned subjects for the selected period.</p></div></div><ProgramTable programs={programStats} /><StudentRosterTable search={search} periodName={periods.find((period) => period.id === selectedPeriodId)?.name ?? "Selected period"} students={studentRoster} programs={studentPrograms} /></section>}

          {page === "Faculty results" && <section className="subpage"><div className="page-heading"><div><p className="eyebrow"><span className="eyebrow__dot" /> LIVE EVALUATION DATA</p><h1>Professor statistics &amp; comments</h1><p className="page-heading__description">Rankings, total points, question averages, response counts, and student comments for each professor.</p></div><label className="report-period-select">Evaluation period<select value={selectedPeriodId} onChange={(event) => setSelectedPeriodId(event.target.value)}>{periods.map((period) => <option key={period.id} value={period.id}>{period.name} · {period.schoolYear} · {period.semester}</option>)}</select></label></div><ProgramTable programs={programStats} /><EvaluationRanking rankings={teacherRankings} selectedTeacher={selectedRankedTeacher || teacherRankings[0]?.name || ""} onSelectTeacher={selectRankedTeacher} detailsHidden={teacherDetailsHidden} onToggleDetails={() => setTeacherDetailsHidden((hidden) => !hidden)} /><DirectoryTable search={search} teachers={teachers} onViewResults={selectRankedTeacher} /></section>}

          {dataError && <div className="notice notice--info" role="alert"><span>ⓘ</span><p>{dataError}</p></div>}
          {loading && <p role="status">Loading live school data…</p>}
          <footer className="page-footer"><span>© 2026 OLOPSC · Faculty Evaluation</span><span><i className="page-footer__status" /> {loading ? "Loading" : dataError ? "Data unavailable" : "Live school data"}</span></footer>
        </div>
      </main>

      {periodDialog && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPeriodDialog(false); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="period-title"><button className="modal__close" type="button" onClick={() => setPeriodDialog(false)} aria-label="Close dialog">×</button><span className="modal__icon">＋</span><h2 id="period-title">Create evaluation period</h2><p>Set up a feedback window for your programs.</p><form onSubmit={createPeriod}><label className="form-field">Period name<input name="name" placeholder="e.g. Final Faculty Evaluation" required /></label><div className="form-grid"><label className="form-field">Semester<select name="semester"><option>1st Semester</option><option>2nd Semester</option><option>Summer</option></select></label><label className="form-field">School year<input name="schoolYear" defaultValue="2026–2027" required /></label></div><div className="form-grid"><label className="form-field">Start date<input type="date" name="start" required /></label><label className="form-field">End date<input type="date" name="end" required /></label></div><button className="button button--primary modal__submit" type="submit">Create period <span>→</span></button></form></section></div>}
      {toast && <div className="toast" role="status" aria-live="polite"><span>{toast}</span><button type="button" onClick={() => setToast("")} aria-label="Dismiss message">×</button></div>}
    </div>
  );
}

function Metric({ title, value, icon, note, trend }: { title: string; value: string; icon: string; note: string; trend: string }) {
  return <article className="metric-card"><div className="metric-card__top"><span>{title}</span><span className="metric-icon">{icon}</span></div><p className="metric-card__value">{value}</p><div className="metric-card__footer"><span>{note}</span><span className="trend">{trend}</span></div></article>;
}

function PeriodRow({ period, activeProgress, onClick }: { period: Period; activeProgress?: number; onClick: () => void }) {
  const { day, month } = dateParts(period.start);
  return <div className={`period-row ${period.status === "Upcoming" ? "period-row--upcoming" : ""}`}><div className={`date-tile ${period.status === "Active" ? "date-tile--active" : ""}`}><strong>{day}</strong><span>{month.toUpperCase()}</span></div><div className="period-row__body"><div className="period-row__title"><strong>{period.name}</strong><span className={`status ${period.status === "Active" ? "status--active" : "status--upcoming"}`}>{period.status}</span></div><p>{period.semester} · AY {period.schoolYear}</p><small>{formatDate(period.start)} – {formatDate(period.end)}, {period.schoolYear.split("–")[0]} · All programs</small>{activeProgress !== undefined && <><div className="progress-caption"><span>Evaluation progress</span><strong>{activeProgress}%</strong></div><Progress value={activeProgress} /></>}</div><button className="row-action" type="button" aria-label={`View ${period.name}`} onClick={onClick}>›</button></div>;
}

function Activity({ icon, title, detail, time, tone = "" }: { icon: string; title: string; detail: string; time: string; tone?: string }) {
  return <article className="activity-item"><span className={`activity-item__icon ${tone ? `activity-item__icon--${tone}` : ""}`}>{icon}</span><div><strong>{title}</strong><p>{detail}</p><small>{time}</small></div></article>;
}

function ProgramTable({ programs }: { programs: ProgramStats[] }) {
  return <section className="panel participation-panel"><div className="panel-heading"><div><h2>Program participation</h2><p>Eligible enrollment and submitted evaluations by program</p></div></div><div className="table-scroll"><table><thead><tr><th>Program</th><th>Eligible enrollments</th><th>Submitted</th><th>Participation</th><th>Status</th></tr></thead><tbody>{programs.map((program) => { const ratio = program.eligible ? Math.round((program.submitted / program.eligible) * 100) : 0; return <tr key={program.code}><td><div className="program-cell"><span className="program-cell__icon">▤</span><span><strong>{program.name}</strong><small>{program.code}</small></span></div></td><td>{program.eligible}</td><td>{program.submitted}</td><td><div className="table-progress"><Progress value={ratio} /><small>{ratio}%</small></div></td><td><span className={`status ${ratio >= 80 ? "status--active" : "status--progress"}`}>{ratio >= 80 ? "On track" : "In progress"}</span></td></tr>; })}</tbody></table>{!programs.length && <p className="empty-state">No enrollment records are available.</p>}</div></section>;
}

function EvaluationRanking({ rankings, selectedTeacher, onSelectTeacher, detailsHidden, onToggleDetails }: { rankings: TeacherRanking[]; selectedTeacher: string; onSelectTeacher: (name: string) => void; detailsHidden: boolean; onToggleDetails: () => void }) {
  const selected = rankings.find((ranking) => ranking.name === selectedTeacher) ?? (selectedTeacher ? undefined : rankings[0]);
  return <section className="panel evaluation-results-panel">
    <div className="panel-heading"><div><h2>Professor rankings</h2><p>Each subject gets its own average. A professor’s overall score is the mean of their subject averages, with each subject weighted equally.</p></div></div>
    {rankings.length ? <>
      <div className="table-scroll"><table><thead><tr><th>Rank</th><th>Professor</th><th>Average rating</th><th>Points collected</th><th>Evaluations</th><th>Comments</th><th>Details</th></tr></thead><tbody>{rankings.map((ranking, index) => <tr key={ranking.name} className={ranking.name === selected?.name ? "is-selected" : ""}><td>{index + 1}</td><td><strong>{ranking.name}</strong></td><td><strong>{ranking.average.toFixed(2)} / 5</strong></td><td>{ranking.totalPoints} / {ranking.possiblePoints}</td><td>{ranking.responses}</td><td>{ranking.comments.length}</td><td><button className="text-link" type="button" onClick={() => onSelectTeacher(ranking.name)} aria-label={`View statistics and comments for ${ranking.name}`}>View details →</button></td></tr>)}</tbody></table></div>
      {selected && <div className="evaluation-results-detail">
        <div className="evaluation-results-detail__heading"><div><h3>{selected.name}: evaluation details</h3>{detailsHidden ? <p>Professor statistics and comments are hidden.</p> : <p>Overall rating: <strong>{selected.average.toFixed(2)} / 5</strong> · {selected.responses} completed {selected.responses === 1 ? "evaluation" : "evaluations"} · {selected.comments.length} {selected.comments.length === 1 ? "comment" : "comments"}</p>}</div><div className="evaluation-results-detail__actions"><label>View professor<select value={selected.name} onChange={(event) => onSelectTeacher(event.target.value)}>{rankings.map((ranking) => <option key={ranking.name} value={ranking.name}>{ranking.name} · {ranking.average.toFixed(2)} / 5</option>)}</select></label><button className="button button--secondary button--small" type="button" onClick={onToggleDetails} aria-expanded={!detailsHidden} aria-controls="professor-results-details">{detailsHidden ? "Show details" : "Hide details"}</button></div></div>
        <div id="professor-results-details" hidden={detailsHidden}><div className="table-scroll"><table className="question-average-table"><thead><tr><th>Course grade (submitted surveys)</th><th>Average</th><th>Points collected</th><th>Submitted surveys</th></tr></thead><tbody>{selected.subjectGrades.map((subject) => <tr key={subject.course}><td><strong>{subject.course}</strong></td><td><strong>{subject.average.toFixed(2)} / 5</strong></td><td>{subject.totalPoints} / {subject.possiblePoints}</td><td>{subject.responses}</td></tr>)}</tbody></table></div><p className="section-copy">Final professor grade = the average of the course grades shown above. Only submitted surveys count.</p><div className="table-scroll"><table className="question-average-table"><thead><tr><th>Subject / question</th><th>Average</th><th>Responses</th></tr></thead><tbody>{selected.questions.map((question, index) => <tr key={`${index}-${question.prompt}`}><td><small>{question.course} · {question.section}</small><span>{String(index + 1).padStart(2, "0")}. {question.prompt}</span></td><td>{question.average === null ? "—" : `${question.average.toFixed(2)} / 5`}</td><td>{question.responses}</td></tr>)}</tbody></table></div>
        <div className="evaluation-comments-results"><h3>Student comments</h3>{selected.comments.length ? selected.comments.map((comment, index) => <article className="evaluation-comment-result" key={`${comment.createdAt}-${index}`}><div><strong>{comment.commenter}</strong><small>{comment.course} · {new Date(comment.createdAt).toLocaleDateString()}</small></div><p>{comment.body}</p></article>) : <p className="empty-state">No comments were submitted for this professor in this period.</p>}</div></div>
      </div>}
      {!selected && selectedTeacher && <div className="evaluation-results-detail"><p className="empty-state">No completed evaluations are available for {selectedTeacher} in this period yet.</p></div>}
    </> : <p className="empty-state">{selectedTeacher ? `No completed evaluations are available for ${selectedTeacher} in this period yet.` : "No completed ratings are available for this evaluation period yet."}</p>}
  </section>;
}

function DirectoryTable({ search, teachers, onViewResults }: { search: string; teachers: Teacher[]; onViewResults?: (name: string) => void }) {
  const visible = teachers.filter((teacher) => `${teacher.name} ${teacher.program} ${teacher.yearLevel} ${teacher.course}`.toLowerCase().includes(search.toLowerCase()));
  const grouped = new Map<string, Map<string, Teacher[]>>();
  for (const teacher of visible) {
    const professors = grouped.get(teacher.program) ?? new Map<string, Teacher[]>();
    professors.set(teacher.name, [...(professors.get(teacher.name) ?? []), teacher]);
    grouped.set(teacher.program, professors);
  }
  const expandMatches = Boolean(search.trim());
  return <section className="panel directory-panel">
    <div className="directory-panel__summary"><strong>{visible.length} course and year assignments</strong><span>Open a program, then a professor, to see their courses and year levels.</span></div>
    <div className="faculty-program-list">{[...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([program, professors]) => {
      const assignmentCount = [...professors.values()].reduce((total, assignments) => total + assignments.length, 0);
      return <details className="faculty-program-group" key={program} open={expandMatches}>
        <summary><span><small>PROGRAM</small><strong>{program}</strong></span><span className="faculty-program-count">{professors.size} {professors.size === 1 ? "professor" : "professors"} · {assignmentCount} {assignmentCount === 1 ? "assignment" : "assignments"}</span></summary>
        <div className="faculty-professors">{[...professors.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, assignments]) => {
          const initials = assignments[0]?.initials ?? name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
          return <details className="faculty-professor-group" key={`${program}-${name}`} open={expandMatches}>
            <summary><span className="avatar">{initials}</span><span className="faculty-professor-name"><strong>{name}</strong><small>{assignments.length} course and year {assignments.length === 1 ? "assignment" : "assignments"}</small></span><span className="faculty-professor-chevron" aria-hidden="true">⌄</span></summary>
            <div className="faculty-assignment-list">{assignments.sort((a, b) => a.course.localeCompare(b.course) || a.yearLevel.localeCompare(b.yearLevel)).map((assignment) => <article className="faculty-assignment" key={assignment.id}><div><strong>{assignment.course}</strong><small>{assignment.yearLevel}</small></div><span className="faculty-assignment-response">{assignment.evaluations}% response rate</span></article>)}
              {onViewResults && <button className="button button--primary faculty-results-link" type="button" onClick={() => onViewResults(name)}>View professor results →</button>}
            </div>
          </details>;
        })}</div>
      </details>;
    })}{visible.length === 0 && <p className="empty-state">No faculty assignments match “{search}”.</p>}</div>
  </section>;
}

function displayYearLevel(value: string) {
  const normalized = value.trim().toLowerCase();
  const numeric = normalized.match(/(?:^|\D)([1-4])(?:\D|$)/)?.[1];
  if (numeric) return `Year ${numeric}`;
  const ordinal = ["first", "second", "third", "fourth"].findIndex((word) => normalized.includes(word));
  if (ordinal >= 0) return `Year ${ordinal + 1}`;
  return value.trim() || "Year level not set";
}

function StudentRosterTable({ search, periodName, students, programs }: { search: string; periodName: string; students: StudentRosterRow[]; programs: StudentProgram[] }) {
  const query = search.trim().toLowerCase();
  const visible = students.filter((student) => `${student.name} ${student.schoolId} ${student.department} ${student.program} ${student.yearLevel} ${student.courses.map((course) => course.label).join(" ")}`.toLowerCase().includes(query));
  const assignedCount = students.filter((student) => student.courses.length > 0).length;
  const expandMatches = Boolean(query);
  const programGroups = new Map<string, { department: string; program: string; students: StudentRosterRow[] }>();

  for (const program of programs) {
    if (query && !`${program.department} ${program.name}`.toLowerCase().includes(query) && !visible.some((student) => student.department === program.department && student.program === program.name)) continue;
    programGroups.set(`${program.department}::${program.name}`, { department: program.department, program: program.name, students: [] });
  }
  for (const student of visible) {
    const key = `${student.department}::${student.program}`;
    const group = programGroups.get(key) ?? { department: student.department, program: student.program, students: [] };
    group.students.push(student);
    programGroups.set(key, group);
  }

  const departments = new Map<string, { department: string; programs: { department: string; program: string; students: StudentRosterRow[] }[] }>();
  for (const group of programGroups.values()) {
    const department = departments.get(group.department) ?? { department: group.department, programs: [] };
    department.programs.push(group);
    departments.set(group.department, department);
  }

  function renderYears(programStudents: StudentRosterRow[]) {
    const yearMap = new Map<string, StudentRosterRow[]>([["Year 1", []], ["Year 2", []], ["Year 3", []], ["Year 4", []]]);
    for (const student of programStudents) {
      const year = displayYearLevel(student.yearLevel);
      yearMap.set(year, [...(yearMap.get(year) ?? []), student]);
    }
    return [...yearMap.entries()].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })).map(([year, yearStudents]) => <details className="student-year-group" key={year} open={expandMatches}>
      <summary><strong>{year}</strong><span>{yearStudents.length} {yearStudents.length === 1 ? "student" : "students"}</span></summary>
      {yearStudents.length ? <ul className="student-year-list">{yearStudents.sort((a, b) => a.name.localeCompare(b.name)).map((student) => <li key={student.id}>
        <div className="student-year-list__identity"><strong>{student.name}</strong><small>Student ID · {student.schoolId}</small></div>
        <div className="student-year-list__subjects"><strong>SUBJECTS</strong>{student.courses.length ? <div>{student.courses.map((course) => <span className="student-subject-tag" key={course.id}>{course.code} · {course.name}</span>)}</div> : <small>No subjects assigned for {periodName}</small>}</div>
      </li>)}</ul> : <p className="student-year-empty">No students in this year level yet.</p>}
    </details>);
  }

  return <section className="panel student-roster-panel">
    <div className="panel-heading"><div><h2>Students by course and year</h2><p>{students.length} student accounts · {assignedCount} with subjects assigned for {periodName}. Each student appears once under their program and year; their subjects are listed below their name.</p></div></div>
    <div className="student-course-groups">{[...departments.values()].sort((a, b) => a.department.localeCompare(b.department)).map(({ department, programs: departmentPrograms }) => {
      const studentCount = new Set(departmentPrograms.flatMap((program) => program.students.map((student) => student.id))).size;
      const subjectCount = new Set(departmentPrograms.flatMap((program) => program.students.flatMap((student) => student.courses.map((course) => course.id)))).size;
      return <details className="student-course-group" key={department} open={expandMatches || !query}>
        <summary><span><small>{department === "Computing Studies" ? "COMPSCI · DEPARTMENT" : "DEPARTMENT"}</small><strong>{department}</strong></span><span className="student-course-group__count">{studentCount} {studentCount === 1 ? "student" : "students"} · {subjectCount} subjects</span></summary>
        <div className="student-program-groups">{departmentPrograms.sort((a, b) => a.program.localeCompare(b.program)).map(({ program, students: programStudents }) => <details className="student-program-group" key={`${department}-${program}`} open={expandMatches}>
          <summary><span><small>PROGRAM</small><strong>{program}</strong></span><span className="student-course-group__count">{programStudents.length} {programStudents.length === 1 ? "student" : "students"}</span></summary>
          <div className="student-year-groups">{renderYears(programStudents)}</div>
        </details>)}</div>
      </details>;
    })}
      {visible.length === 0 && <p className="empty-state">No student accounts match “{search}”.</p>}
    </div>
  </section>;
}
