"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "../lib/supabase/client";

type Page = "Overview" | "Evaluation periods" | "Teachers" | "Students" | "Reports";
type Teacher = { id: string; name: string; role: string; program: string; yearLevel: string; course: string; initials: string; evaluations: number };
type Period = { id: string; name: string; semester: string; schoolYear: string; start: string; end: string; status: "Active" | "Upcoming" | "Closed" };
type ProgramStats = { name: string; code: string; eligible: number; submitted: number };

const navigation: { title: string; icon: string; group: string }[] = [
  { title: "Overview", icon: "⌂", group: "Workspace" },
  { title: "Evaluation periods", icon: "◷", group: "Workspace" },
  { title: "Teachers", icon: "♙", group: "Management" },
  { title: "Students", icon: "♧", group: "Management" },
  { title: "Reports", icon: "▥", group: "Insights" },
];

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
  const [programStats, setProgramStats] = useState<ProgramStats[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [dataError, setDataError] = useState("");
  const [totalStudents, setTotalStudents] = useState(0);
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
  const participation = Math.round((submitted / totalEligible) * 1000) / 10;
  const filteredTeachers = teachers.filter((teacher) => `${teacher.name} ${teacher.program} ${teacher.yearLevel} ${teacher.course}`.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    let active = true;
    async function loadDashboard() {
      const db = createClient();
      const [periodResult, courseResult, instructorResult, professorResult, studentResult, enrollmentResult, submissionResult] = await Promise.all([
        db.from("evaluation_periods").select("id,name,semester,school_year,starts_at,ends_at,is_open").order("starts_at", { ascending: false }),
        db.from("courses").select("id,code,name,program_id,programs(name,department)"),
        db.from("course_instructors").select("course_id,instructors(full_name)"),
        db.from("course_professors").select("course_id,profiles(full_name,role)"),
        db.from("student_records").select("student_id,year_level,program_id,programs(name)"),
        db.from("student_enrollments").select("student_id,course_id,period_id"),
        db.from("evaluation_submissions").select("student_id,course_id,period_id"),
      ]);
      const failed = [periodResult, courseResult, instructorResult, professorResult, studentResult, enrollmentResult, submissionResult].find((result) => result.error);
      if (failed?.error) { if (active) { setDataError(`Could not load admin data: ${failed.error.message}`); setLoading(false); } return; }
      if (!active) return;
      const periodsData = periodResult.data ?? [];
      const now = Date.now();
      const mappedPeriods: Period[] = periodsData.map((p: any) => ({ id: p.id, name: p.name, semester: p.semester, schoolYear: p.school_year, start: p.starts_at.slice(0,10), end: p.ends_at.slice(0,10), status: p.is_open && Date.parse(p.starts_at) <= now && Date.parse(p.ends_at) >= now ? "Active" : Date.parse(p.starts_at) > now ? "Upcoming" : "Closed" }));
      setPeriods(mappedPeriods);
      const activePeriodId = mappedPeriods.find((p) => p.status === "Active")?.id ?? mappedPeriods[0]?.id ?? "";
      setSelectedPeriodId(activePeriodId);
      const students = studentResult.data ?? [];
      const enrollments = (enrollmentResult.data ?? []).filter((e: any) => e.period_id === activePeriodId);
      const submissions = (submissionResult.data ?? []).filter((s: any) => s.period_id === activePeriodId);
      const courses = courseResult.data ?? [];
      setTotalStudents(enrollments.length);
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
        for (const teacherName of new Set(instructorNames.get(course.id) ?? [])) {
          const matchedEnrollments = enrollments.filter((e: any) => e.course_id === course.id);
          const byYear = new Map<string, string[]>();
          for (const enrollment of matchedEnrollments) {
            const record: any = students.find((s: any) => s.student_id === enrollment.student_id);
            const year = record?.year_level?.trim() || "Year level not set";
            byYear.set(year, [...(byYear.get(year) ?? []), enrollment.student_id]);
          }
          for (const [year, eligibleIds] of byYear) {
            const eligible = eligibleIds.length;
            const responseIds = new Set(submissions.filter((s: any) => s.course_id === course.id).map((s: any) => s.student_id));
            const responses = eligibleIds.filter((id) => responseIds.has(id)).length;
            const key = `${teacherName}|${program?.name}|${year}|${course.id}`;
            grouped.set(key, { id: key, name: teacherName, role: "Faculty", program: program?.name ?? "", yearLevel: year, course: `${course.code} · ${course.name}`, initials: teacherName.split(/\s+/).slice(0,2).map((p: string)=>p[0]).join("").toUpperCase(), evaluations: eligible ? Math.round(responses / eligible * 100) : 0 });
          }
        }
      }
      setTeachers([...grouped.values()]);
      setDataError(""); setLoading(false);
    }
    void loadDashboard();
    return () => { active = false; };
  }, []);

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

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNavOpen ? "is-open" : ""}`}>
        <a className="brand" href="#overview" onClick={(event) => { event.preventDefault(); changePage("Overview"); }}>
          <img className="brand__logo" src="/olopsc-bmse-logo.webp" alt="" />
          <span className="brand__identity"><strong>Our Lady Of Perpetual Succor College of Business Management, Science and Education</strong><small>FACULTY EVALUATION SYSTEM</small></span>
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
              <article className="metric-card"><div className="metric-card__top"><span>Submissions received</span><span className="metric-icon">✓</span></div><p className="metric-card__value">{submitted.toLocaleString()} <span className="metric-card__total">/ {totalEligible.toLocaleString()}</span></p><Progress value={participation} light /><div className="metric-card__footer"><span>{participation}% participation</span><span className="trend">{loading ? "Loading" : "Live data"}</span></div></article>
              <Metric title="Participation target" value="90%" icon="◎" note={`${Math.max(0, Math.ceil(totalEligible * 0.9 - submitted)).toLocaleString()} more submissions to reach target`} trend="School goal" />
            </section>
            <section className="overview-grid">
              <article className="panel periods-panel"><div className="panel-heading"><div><h2>Evaluation periods</h2><p>Active and upcoming school evaluation cycles</p></div><button className="text-link" onClick={() => changePage("Evaluation periods")}>View all <span>→</span></button></div>
                {periods.slice(0, 2).map((period, index) => <PeriodRow key={period.id} period={period} activeProgress={index === 0 ? participation : undefined} onClick={() => changePage("Evaluation periods")} />)}
              </article>
              <article className="panel activity-panel"><div className="panel-heading"><div><h2>Recent activity</h2><p>Latest updates in your workspace</p></div><span className="live-indicator"><i /> Live</span></div><div className="activity-list"><Activity icon="♙" title="Faculty roster is ready" detail="128 teachers across 3 programs" time="Today" /><Activity icon="✓" tone="green" title="Midterm evaluation is open" detail="Students can submit course feedback" time="Nov 2" /><Activity icon="▣" tone="gold" title="Evaluation criteria reviewed" detail="5 teaching practices in this form" time="Oct 30" /></div></article>
            </section>
            <ProgramTable programs={programStats} />
            <section className="quick-actions"><strong>Quick actions</strong><button onClick={() => changePage("Teachers")}>♙ &nbsp;Browse teachers <span className="quick-actions__plus">→</span></button><button onClick={() => setPeriodDialog(true)}>◷ &nbsp;Open a new period <span className="quick-actions__plus">＋</span></button></section>
          </>}

          {page === "Evaluation periods" && <section className="subpage"><div className="page-heading"><div><p className="eyebrow"><span className="eyebrow__dot" /> ACADEMIC YEAR 2026–2027</p><h1>Evaluation periods</h1><p className="page-heading__description">Plan and monitor the feedback cycles for your school.</p></div><button className="button button--primary" onClick={() => setPeriodDialog(true)}>＋ <span>New evaluation period</span></button></div><div className="periods-list">{periods.map((period, index) => <article className="panel period-card" key={period.id}><div className={`period-card__calendar ${period.status === "Active" ? "period-card__calendar--active" : ""}`}><strong>{dateParts(period.start).day}</strong><span>{dateParts(period.start).month.toUpperCase()}</span></div><div className="period-card__main"><div className="period-row__title"><h2>{period.name}</h2><span className={`status ${period.status === "Active" ? "status--active" : "status--upcoming"}`}>{period.status}</span></div><p>{period.semester} · AY {period.schoolYear} · All academic programs</p><small>{formatDate(period.start)} – {formatDate(period.end)}, {period.schoolYear.split("–")[0]}</small>{index === 0 && <><div className="progress-caption"><span>Student participation</span><strong>{participation}%</strong></div><Progress value={participation} /></>}</div><button className="row-action" type="button" aria-label={`Open ${period.name}`} onClick={() => setToast(`${period.name} details selected.`)}>›</button></article>)}</div></section>}

          {page === "Teachers" && <section className="subpage"><div className="page-heading"><div><p className="eyebrow"><span className="eyebrow__dot" /> SCHOOL DIRECTORY</p><h1>Teachers</h1><p className="page-heading__description">Faculty assignments grouped by course and enrolled student year level.</p></div></div><DirectoryTable search={search} teachers={teachers} /></section>}

          {page === "Students" && <section className="subpage"><div className="page-heading"><div><p className="eyebrow"><span className="eyebrow__dot" /> SCHOOL DIRECTORY</p><h1>Students</h1><p className="page-heading__description">Review participation by academic program.</p></div></div><ProgramTable programs={programStats} /></section>}

          {page === "Reports" && <section className="subpage"><div className="page-heading"><div><p className="eyebrow"><span className="eyebrow__dot" /> LIVE EVALUATION DATA</p><h1>Participation report</h1><p className="page-heading__description">Response coverage across programs.</p></div></div><ProgramTable programs={programStats} /><DirectoryTable search={search} teachers={teachers} /></section>}

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

function DirectoryTable({ search, teachers }: { search: string; teachers: Teacher[] }) {
  const visible = teachers.filter((teacher) => `${teacher.name} ${teacher.program} ${teacher.yearLevel} ${teacher.course}`.toLowerCase().includes(search.toLowerCase()));
  return <section className="panel directory-panel"><div className="directory-panel__summary"><strong>{visible.length} faculty assignments</strong><span>Grouped by course and student year level</span></div><div className="table-scroll"><table><thead><tr><th>Teacher</th><th>Program</th><th>Year level</th><th>Assigned course</th><th>Evaluation status</th></tr></thead><tbody>{visible.map((teacher) => <tr key={teacher.id}><td><div className="program-cell"><span className="avatar">{teacher.initials}</span><span><strong>{teacher.name}</strong><small>{teacher.role}</small></span></div></td><td>{teacher.program}</td><td>{teacher.yearLevel}</td><td>{teacher.course}</td><td><span className="status status--active">{teacher.evaluations}% responses</span></td></tr>)}</tbody></table>{visible.length === 0 && <p className="empty-state">No faculty assignments match “{search}”.</p>}</div></section>;
}
