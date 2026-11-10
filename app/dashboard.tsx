"use client";

import { useState, type FormEvent } from "react";

type Page = "Overview" | "Evaluation periods" | "Evaluate faculty" | "Teachers" | "Students" | "Reports";
type Teacher = { id: number; name: string; role: string; program: string; course: string; initials: string; evaluations: number };
type Period = { id: number; name: string; semester: string; schoolYear: string; start: string; end: string; status: "Active" | "Upcoming" | "Closed" };

const criteria = [
  "Explains course concepts clearly",
  "Encourages questions and discussion",
  "Provides useful feedback on student work",
  "Uses class time and learning materials effectively",
  "Treats students fairly and respectfully",
];

const teachers: Teacher[] = [
  { id: 1, name: "Daniel Reyes", role: "Associate Professor", program: "BS Information Technology", course: "Web Application Development", initials: "DR", evaluations: 84 },
  { id: 2, name: "Angela Santos", role: "Assistant Professor", program: "BS Computer Science", course: "Data Structures and Algorithms", initials: "AS", evaluations: 91 },
  { id: 3, name: "Miguel Dela Cruz", role: "Instructor", program: "BS Business Administration", course: "Principles of Management", initials: "MD", evaluations: 67 },
  { id: 4, name: "Sofia Mendoza", role: "Assistant Professor", program: "BS Information Technology", course: "Database Management Systems", initials: "SM", evaluations: 78 },
];

const initialPeriods: Period[] = [
  { id: 1, name: "Midterm Faculty Evaluation", semester: "1st Semester", schoolYear: "2026–2027", start: "2026-11-02", end: "2026-11-27", status: "Active" },
  { id: 2, name: "Final Faculty Evaluation", semester: "1st Semester", schoolYear: "2026–2027", start: "2026-12-01", end: "2026-12-18", status: "Upcoming" },
];

const navigation: { title: string; icon: string; group: string }[] = [
  { title: "Overview", icon: "⌂", group: "Workspace" },
  { title: "Evaluation periods", icon: "◷", group: "Workspace" },
  { title: "Evaluate faculty", icon: "✓", group: "Evaluation" },
  { title: "Teachers", icon: "♙", group: "Management" },
  { title: "Students", icon: "♧", group: "Management" },
  { title: "Reports", icon: "▥", group: "Insights" },
];

const programs = [
  { name: "Computer Science", code: "BSCS", eligible: 248, submitted: 228 },
  { name: "Information Technology", code: "BSIT", eligible: 386, submitted: 328 },
  { name: "Business Administration", code: "BSBA", eligible: 312, submitted: 244 },
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
  const [periods, setPeriods] = useState(initialPeriods);
  const [periodDialog, setPeriodDialog] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [ratings, setRatings] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(2079);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const totalEligible = 2458;
  const nameParts = adminName.trim().split(/\s+/).filter((part) => part.length > 1);
  const adminInitials = nameParts.length > 1 ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase() : (nameParts[0] ?? "A").slice(0, 2).toUpperCase();
  const firstName = adminName.trim().split(/\s+/)[0] || adminName;
  const participation = Math.round((submitted / totalEligible) * 1000) / 10;
  const filteredTeachers = teachers.filter((teacher) => `${teacher.name} ${teacher.program} ${teacher.course}`.toLowerCase().includes(search.toLowerCase()));

  function openEvaluation(teacher: Teacher) {
    setSelectedTeacher(teacher);
    setRatings({});
    setPage("Evaluate faculty");
  }

  function submitEvaluation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (criteria.some((_, index) => !ratings[index])) {
      setToast("Please rate every teaching criterion before submitting.");
      return;
    }
    setSubmitted((count) => Math.min(count + 1, totalEligible));
    setSelectedTeacher(null);
    setPage("Overview");
    setToast("Thank you. Your sample evaluation was recorded for this session.");
  }

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
    setPeriods((items) => [...items, { id: Date.now(), name, semester, schoolYear, start, end, status: "Upcoming" }]);
    setPeriodDialog(false);
    setToast("Evaluation period added to this session.");
    event.currentTarget.reset();
  }

  function changePage(nextPage: string) {
    setPage(nextPage as Page);
    setSelectedTeacher(null);
    setMobileNavOpen(false);
    setSearch("");
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNavOpen ? "is-open" : ""}`}>
        <a className="brand" href="#overview" onClick={(event) => { event.preventDefault(); changePage("Overview"); }}>
          <span className="brand__mark">◇</span>
          <span><strong>OLOPSC</strong><small>FACULTY EVALUATION<br />SYSTEM</small></span>
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
              <div><p className="eyebrow"><span className="eyebrow__dot" /> SCHOOL YEAR 2026–2027 <span>·</span> FIRST SEMESTER</p><h1>Good morning, {firstName} <span className="heading__spark">✳</span></h1><p className="page-heading__description">A clear view of participation and faculty feedback across OLOPSC.</p></div>
              <button className="button button--primary" type="button" onClick={() => setPeriodDialog(true)}>＋ <span>New evaluation period</span></button>
            </section>
            <section className="metric-grid" aria-label="Evaluation overview">
              <Metric title="Total teachers" value="128" icon="♙" note="Across 3 academic programs" trend="+8 this year" />
              <Metric title="Eligible students" value="2,458" icon="♧" note="Students assigned to courses" trend="AY 2026–2027" />
              <article className="metric-card"><div className="metric-card__top"><span>Submissions received</span><span className="metric-icon">✓</span></div><p className="metric-card__value">{submitted.toLocaleString()} <span className="metric-card__total">/ 2,458</span></p><Progress value={participation} light /><div className="metric-card__footer"><span>{participation}% participation</span><span className="trend">In progress</span></div></article>
              <Metric title="Participation target" value="90%" icon="◎" note={`${Math.max(0, Math.ceil(totalEligible * 0.9 - submitted)).toLocaleString()} more submissions to reach target`} trend="School goal" />
            </section>
            <section className="overview-grid">
              <article className="panel periods-panel"><div className="panel-heading"><div><h2>Evaluation periods</h2><p>Active and upcoming school evaluation cycles</p></div><button className="text-link" onClick={() => changePage("Evaluation periods")}>View all <span>→</span></button></div>
                {periods.slice(0, 2).map((period, index) => <PeriodRow key={period.id} period={period} activeProgress={index === 0 ? participation : undefined} onClick={() => changePage("Evaluation periods")} />)}
              </article>
              <article className="panel activity-panel"><div className="panel-heading"><div><h2>Recent activity</h2><p>Latest updates in your workspace</p></div><span className="live-indicator"><i /> Live</span></div><div className="activity-list"><Activity icon="♙" title="Faculty roster is ready" detail="128 teachers across 3 programs" time="Today" /><Activity icon="✓" tone="green" title="Midterm evaluation is open" detail="Students can submit course feedback" time="Nov 2" /><Activity icon="▣" tone="gold" title="Evaluation criteria reviewed" detail="5 teaching practices in this form" time="Oct 30" /></div></article>
            </section>
            <ProgramTable />
            <section className="quick-actions"><strong>Quick actions</strong><button onClick={() => changePage("Teachers")}>♙ &nbsp;Browse teachers <span className="quick-actions__plus">→</span></button><button onClick={() => changePage("Evaluate faculty")}>✓ &nbsp;Start an evaluation <span className="quick-actions__plus">→</span></button><button onClick={() => setPeriodDialog(true)}>◷ &nbsp;Open a new period <span className="quick-actions__plus">＋</span></button></section>
          </>}

          {page === "Evaluate faculty" && <section className="subpage">
            <div className="page-heading"><div><p className="eyebrow"><span className="eyebrow__dot" /> STUDENT WORKSPACE</p><h1>{selectedTeacher ? "Evaluate your teacher" : "Your course evaluations"}</h1><p className="page-heading__description">Share thoughtful feedback about the courses you are taking this semester.</p></div><span className="status status--active">Midterm period open</span></div>
            <div className="notice notice--info"><span>ⓘ</span><p>This is a working prototype. Submissions stay in this browser session and are not sent to the school.</p></div>
            {selectedTeacher ? <article className="panel evaluation-card">
              <button className="text-link back-link" type="button" onClick={() => setSelectedTeacher(null)}>← Back to course list</button>
              <div className="teacher-heading"><span className="avatar avatar--large">{selectedTeacher.initials}</span><div><h2>{selectedTeacher.name}</h2><p>{selectedTeacher.course} · {selectedTeacher.program}</p></div><span className="step-indicator">1 <span>/</span> 2</span></div>
              <div className="form-divider" /><h3>Teaching and learning</h3><p className="section-copy">Rate each statement based on your experience in this course.</p>
              <form onSubmit={submitEvaluation}>
                {criteria.map((criterion, index) => <fieldset className="rating-field" key={criterion}><legend><span>{String(index + 1).padStart(2, "0")}</span>{criterion}</legend><div className="rating-options" aria-label={`Rating for ${criterion}`}>{[1, 2, 3, 4, 5].map((score) => <button key={score} type="button" className={`rating-option ${ratings[index] === score ? "is-selected" : ""}`} aria-pressed={ratings[index] === score} onClick={() => setRatings((current) => ({ ...current, [index]: score }))}><strong>{score}</strong><small>{["Needs work", "Fair", "Good", "Very good", "Excellent"][score - 1]}</small></button>)}</div></fieldset>)}
                <label className="comment-field">Additional comments <span>Optional</span><textarea name="comment" rows={4} placeholder="Share a specific example or suggestion that could help this teacher..." /></label>
                <div className="form-actions"><button className="button button--secondary" type="button" onClick={() => setSelectedTeacher(null)}>Save for later</button><button className="button button--primary" type="submit">Submit evaluation <span>→</span></button></div>
              </form>
            </article> : <div className="course-grid">{filteredTeachers.map((teacher) => <article className="panel course-card" key={teacher.id}><div className="course-card__top"><span className="avatar avatar--large">{teacher.initials}</span><span className="status status--active">Ready</span></div><p className="course-card__program">{teacher.program}</p><h2>{teacher.course}</h2><p className="course-card__teacher">{teacher.name} <span>·</span> {teacher.role}</p><div className="course-card__footer"><span>Midterm evaluation</span><button className="button button--primary button--small" onClick={() => openEvaluation(teacher)}>Start <span>→</span></button></div></article>)}</div>}
          </section>}

          {page === "Evaluation periods" && <section className="subpage"><div className="page-heading"><div><p className="eyebrow"><span className="eyebrow__dot" /> ACADEMIC YEAR 2026–2027</p><h1>Evaluation periods</h1><p className="page-heading__description">Plan and monitor the feedback cycles for your school.</p></div><button className="button button--primary" onClick={() => setPeriodDialog(true)}>＋ <span>New evaluation period</span></button></div><div className="periods-list">{periods.map((period, index) => <article className="panel period-card" key={period.id}><div className={`period-card__calendar ${period.status === "Active" ? "period-card__calendar--active" : ""}`}><strong>{dateParts(period.start).day}</strong><span>{dateParts(period.start).month.toUpperCase()}</span></div><div className="period-card__main"><div className="period-row__title"><h2>{period.name}</h2><span className={`status ${period.status === "Active" ? "status--active" : "status--upcoming"}`}>{period.status}</span></div><p>{period.semester} · AY {period.schoolYear} · All academic programs</p><small>{formatDate(period.start)} – {formatDate(period.end)}, {period.schoolYear.split("–")[0]}</small>{index === 0 && <><div className="progress-caption"><span>Student participation</span><strong>{participation}%</strong></div><Progress value={participation} /></>}</div><button className="row-action" type="button" aria-label={`Open ${period.name}`} onClick={() => setToast(`${period.name} details selected.`)}>›</button></article>)}</div></section>}

          {page === "Teachers" && <section className="subpage"><div className="page-heading"><div><p className="eyebrow"><span className="eyebrow__dot" /> SCHOOL DIRECTORY</p><h1>Teachers</h1><p className="page-heading__description">Faculty linked to courses in this evaluation cycle.</p></div><button className="button button--secondary" onClick={() => setToast("Teacher management can be connected to the school directory.")}>＋ <span>Add teacher</span></button></div><DirectoryTable search={search} /></section>}

          {page === "Students" && <section className="subpage"><div className="page-heading"><div><p className="eyebrow"><span className="eyebrow__dot" /> SCHOOL DIRECTORY</p><h1>Students</h1><p className="page-heading__description">Review participation by academic program.</p></div><button className="button button--secondary" onClick={() => setToast("Student records can be imported from the school directory.")}>＋ <span>Import students</span></button></div><ProgramTable /><div className="notice notice--info"><span>ⓘ</span><p>Student names and records are not included in this prototype. Connect the school’s student information system before inviting students.</p></div></section>}

          {page === "Reports" && <section className="subpage"><div className="page-heading"><div><p className="eyebrow"><span className="eyebrow__dot" /> MIDTERM EVALUATION</p><h1>Participation report</h1><p className="page-heading__description">A sample view of response coverage across programs.</p></div><button className="button button--secondary" onClick={() => setToast("Report export will be available after a reporting backend is connected.")}>↓ <span>Export report</span></button></div><ProgramTable /><article className="panel report-note"><h2>Reading this report</h2><p>Participation counts show submitted evaluations against eligible students. Individual teacher results should only be released according to school policy and minimum response thresholds.</p></article></section>}

          <footer className="page-footer"><span>© 2026 OLOPSC · Faculty Evaluation</span><span><i className="page-footer__status" /> Prototype data <b>·</b> School year 2026–2027</span></footer>
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

function ProgramTable() {
  return <section className="panel participation-panel"><div className="panel-heading"><div><h2>Program participation</h2><p>Evaluation coverage by academic program</p></div><span className="status status--active">Midterm</span></div><div className="table-scroll"><table><thead><tr><th>Program</th><th>Eligible students</th><th>Submitted</th><th>Participation</th><th>Status</th></tr></thead><tbody>{programs.map((program) => { const ratio = Math.round((program.submitted / program.eligible) * 100); return <tr key={program.code}><td><div className="program-cell"><span className="program-cell__icon">▤</span><span><strong>{program.name}</strong><small>{program.code}</small></span></div></td><td>{program.eligible}</td><td>{program.submitted}</td><td><div className="table-progress"><Progress value={ratio} /><small>{ratio}%</small></div></td><td><span className={`status ${ratio >= 80 ? "status--active" : "status--progress"}`}>{ratio >= 80 ? "On track" : "In progress"}</span></td></tr>; })}</tbody></table></div></section>;
}

function DirectoryTable({ search }: { search: string }) {
  const visible = teachers.filter((teacher) => `${teacher.name} ${teacher.program} ${teacher.course}`.toLowerCase().includes(search.toLowerCase()));
  return <section className="panel directory-panel"><div className="directory-panel__summary"><strong>{visible.length} teachers</strong><span>Assigned for the active semester</span></div><div className="table-scroll"><table><thead><tr><th>Teacher</th><th>Program</th><th>Assigned course</th><th>Evaluation status</th></tr></thead><tbody>{visible.map((teacher) => <tr key={teacher.id}><td><div className="program-cell"><span className="avatar">{teacher.initials}</span><span><strong>{teacher.name}</strong><small>{teacher.role}</small></span></div></td><td>{teacher.program}</td><td>{teacher.course}</td><td><span className="status status--active">{teacher.evaluations}% responses</span></td></tr>)}</tbody></table>{visible.length === 0 && <p className="empty-state">No teachers match “{search}”.</p>}</div></section>;
}
