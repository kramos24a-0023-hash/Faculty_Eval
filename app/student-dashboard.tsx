"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "../lib/supabase/client";

export type Course = {
  id: string | number;
  periodId?: string;
  course: string;
  code: string;
  teacher: string;
  initials: string;
  program: string;
};

export type StudentAccess = {
  name: string;
  studentId: string;
  enrollmentDate: string;
  program: string;
  yearLevel: string;
  courses?: Course[];
  criteria?: { id: string; prompt: string }[];
  completedCourseIds?: (string | number)[];
  periodId?: string;
  periodName?: string;
  periodEnd?: string;
  periodIsOpen?: boolean;
  isSupabaseUser?: boolean;
};

const navItems = [
  { label: "Overview", icon: "⌂" },
  { label: "My evaluations", icon: "✓" },
  { label: "Find a professor", icon: "⌕" },
  { label: "Profile", icon: "♙" },
  { label: "How it works", icon: "ⓘ" },
];

export default function StudentDashboard({ student, onLogout }: { student: StudentAccess; onLogout: () => void }) {
  const courses = student.courses ?? [];
  const criteriaRows = student.criteria ?? [];
  const criteria = criteriaRows.map((criterion) => criterion.prompt);
  const [page, setPage] = useState("Overview");
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [evaluationStep, setEvaluationStep] = useState<"guide" | "survey">("guide");
  const [ratings, setRatings] = useState<Record<number, number>>({});
  const [showValidation, setShowValidation] = useState(false);
  const [completedIds, setCompletedIds] = useState<string[]>(() => (student.completedCourseIds ?? []).map(String));
  const [professorSearch, setProfessorSearch] = useState("");
  const [toast, setToast] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const pendingCount = courses.length - completedIds.length;
  const missingRatingCount = criteria.filter((_, index) => !ratings[index]).length;
  const directoryQuery = professorSearch.trim().toLocaleLowerCase();
  const directorySearchTerms = directoryQuery.split(/\s+/).filter(Boolean);
  const matchingDirectoryPrograms = Array.from(new Set(courses.map((course) => course.program))).map((program) => ({
    program,
    courses: courses.filter((course) => course.program === program && directorySearchTerms.every((term) => `${course.program} ${course.course} ${course.code} ${course.teacher}`.toLocaleLowerCase().includes(term))).map((course) => ({ id: course.id, course: course.course, code: course.code, professor: course.teacher, initials: course.initials })),
  })).filter((group) => group.courses.length > 0);
  const matchingDirectoryCourseCount = matchingDirectoryPrograms.reduce((count, group) => count + group.courses.length, 0);

  function openCourse(course: Course) {
    setSelectedCourse(course);
    setRatings({});
    setShowValidation(false);
    setEvaluationStep("guide");
    setPage("My evaluations");
  }

  function changePage(nextPage: string) {
    setPage(nextPage);
    setSelectedCourse(null);
    setEvaluationStep("guide");
    setMobileNavOpen(false);
  }

  function rateCriterion(index: number, score: number) {
    const updatedRatings = { ...ratings, [index]: score };
    setRatings(updatedRatings);
    if (criteria.every((_, criterionIndex) => updatedRatings[criterionIndex])) {
      setShowValidation(false);
    }
  }

  async function submitEvaluation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCourse) return;
    if (student.isSupabaseUser && criteriaRows.length === 0) {
      setToast("This evaluation period has no active questions yet. Please contact your school administrator.");
      return;
    }
    if (criteria.some((_, index) => !ratings[index])) {
      setShowValidation(true);
      return;
    }

    const form = new FormData(event.currentTarget);
    const comment = String(form.get("comment") ?? "").trim();
    const commentAnonymous = form.get("identifyComment") !== "on";
    if (student.isSupabaseUser) {
      if (!selectedCourse.periodId) { setToast("There is no active evaluation period for this course."); return; }
      const { error } = await createClient().rpc("submit_course_evaluation", {
        p_course_id: String(selectedCourse.id),
        p_period_id: selectedCourse.periodId,
        p_ratings: criteriaRows.map((criterion, index) => ({ criterion_id: criterion.id, rating: ratings[index] })),
        p_comment: comment || null,
        p_comment_anonymous: commentAnonymous,
      });
      if (error) { setToast(error.message.includes("duplicate key") ? "This course has already been evaluated." : error.message); return; }
    }

    setCompletedIds((current) => [...current, String(selectedCourse.id)]);
    setSelectedCourse(null);
    setEvaluationStep("guide");
    setPage("Overview");
    setToast("Thank you. Your evaluation was submitted securely.");
  }

  return (
    <div className="app-shell student-shell">
      <aside className={`sidebar ${mobileNavOpen ? "is-open" : ""}`}>
        <a className="brand" href="#student-overview" onClick={(event) => { event.preventDefault(); changePage("Overview"); }}>
          <span className="brand__mark">◇</span>
          <span><strong>OLOPSC</strong><small>FACULTY EVALUATION<br />SYSTEM</small></span>
        </a>
        <div className="workspace-switch"><span className="workspace-switch__icon">♧</span><span><strong>Student workspace</strong><small>{student.program}</small></span><span className="muted">⌄</span></div>
        <nav className="primary-nav" aria-label="Student navigation">
          <div className="nav-group">
            <p className="nav-label">My workspace</p>
            {navItems.map((item) => (
              <button key={item.label} className={`nav-item ${page === item.label ? "is-active" : ""}`} type="button" onClick={() => changePage(item.label)} aria-current={page === item.label ? "page" : undefined}>
                <span className="nav-item__icon" aria-hidden="true">{item.icon}</span>{item.label}
                {item.label === "My evaluations" && pendingCount > 0 && <span className="nav-badge">{pendingCount}</span>}
              </button>
            ))}
          </div>
        </nav>
        <div className="sidebar__bottom">
          <div className="help-card"><span className="help-card__icon">?</span><span><strong>Need a hand?</strong><small>Ask your school coordinator</small></span><span className="muted">↗</span></div>
          <div className="user-profile"><span className="avatar avatar--sidebar">AR</span><span><strong>{student.name}</strong><small>{student.yearLevel} student</small></span></div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu" type="button" aria-label="Toggle navigation" aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen((open) => !open)}>☰</button>
          <div className="breadcrumb"><span>Student workspace</span><span aria-hidden="true">/</span><strong>{selectedCourse ? "Your evaluation" : page}</strong></div>
          <div className="top-actions"><span className="student-year">SCHOOL YEAR 2026–2027</span><span className="avatar" aria-label={student.name}>AR</span><button className="button button--secondary button--small student-logout" type="button" onClick={onLogout}>Log out</button></div>
        </header>

        <div className="content">
          {page === "Overview" && !selectedCourse && <>
            <section className="student-welcome">
              <div><p className="eyebrow"><span className="eyebrow__dot" /> YOUR VOICE HELPS US GROW</p><h1>Good morning, {student.name.split(" ")[0]} <span className="heading__spark">✳</span></h1><p>Share thoughtful feedback about your classes this semester.</p><div className="student-welcome__meta"><span>{student.yearLevel}</span><i /> <span>{student.program}</span><i /> <span>ID {student.studentId}</span></div></div>
              <div className="student-welcome__art" aria-hidden="true"><span>✦</span><strong>Every voice<br />matters.</strong><small>OLOPSC · 2026–2027</small></div>
            </section>


            <section className="student-metrics" aria-label="Your evaluation progress">
              <article className="student-metric"><span className="student-metric__icon">✓</span><div><small>Courses to evaluate</small><strong>{courses.length}</strong><p>In your current schedule</p></div></article>
              <article className="student-metric"><span className="student-metric__icon student-metric__icon--gold">◷</span><div><small>Still to complete</small><strong>{pendingCount}</strong><p>Midterm evaluation</p></div></article>
              <article className="student-metric"><span className="student-metric__icon student-metric__icon--green">✦</span><div><small>Completed</small><strong>{completedIds.length} <em>/ {courses.length}</em></strong><p>Thank you for participating</p></div></article>
            </section>

            <section className="student-section-heading"><div><p className="eyebrow"><span className="eyebrow__dot" /> {student.periodName ?? "MIDTERM · 1ST SEMESTER"}</p><h2>Your course evaluations</h2><p>Complete one short evaluation for each course below.</p></div><span className="status status--active">{student.periodEnd ? `Open until ${new Date(student.periodEnd).toLocaleDateString()}` : "Open until Nov 27"}</span></section>
            {courses.length ? <div className="student-course-list">{courses.map((course) => <StudentCourseCard key={course.id} course={course} complete={completedIds.includes(String(course.id))} onStart={() => openCourse(course)} />)}</div> : <div className="professor-no-results"><strong>No courses are assigned to your account yet.</strong><p>Ask your school administrator to add your current enrollment.</p></div>}
            <p className="student-footer-note">Your honest, respectful feedback helps teachers reflect on what is working well and where they can improve.</p>
          </>}

          {page === "My evaluations" && !selectedCourse && <section className="subpage"><div className="student-section-heading"><div><p className="eyebrow"><span className="eyebrow__dot" /> MIDTERM · 1ST SEMESTER</p><h1>My evaluations</h1><p>Review what is ready and what you have completed.</p></div><span className="status status--active">{student.periodName ?? "Midterm · 1st semester"}{student.periodEnd ? ` · ${new Date(student.periodEnd).toLocaleDateString()}` : " · Open until Nov 27"}</span></div><div className="student-course-list">{courses.map((course) => <StudentCourseCard key={course.id} course={course} complete={completedIds.includes(String(course.id))} onStart={() => openCourse(course)} />)}</div></section>}

          {page === "How it works" && <section className="subpage"><div className="student-section-heading"><div><p className="eyebrow"><span className="eyebrow__dot" /> STUDENT GUIDE</p><h1>How evaluations work</h1><p>A few simple steps for useful, respectful feedback.</p></div></div><div className="student-guide-grid"><article className="panel student-guide-card"><span>01</span><h2>Think about the whole semester</h2><p>Reflect on your experiences in the course, not just one recent class or assignment.</p></article><article className="panel student-guide-card"><span>02</span><h2>Rate each statement</h2><p>Choose the response that best describes your experience. There are no right or wrong answers.</p></article><article className="panel student-guide-card"><span>03</span><h2>Keep comments constructive</h2><p>Specific, respectful examples help teachers understand what supports your learning.</p></article></div></section>}

          {page === "Find a professor" && <section className="subpage">
            <div className="student-section-heading"><div><p className="eyebrow"><span className="eyebrow__dot" /> YOUR COURSE PROFESSORS</p><h1>Find your professor</h1><p>Search the professors teaching your assigned courses this semester.</p></div></div>
            <div className="professor-search"><span aria-hidden="true">⌕</span><input type="search" value={professorSearch} onChange={(event) => setProfessorSearch(event.target.value)} placeholder="Try Daniel Reyes or IT 302..." aria-label="Search your professors and courses" />{professorSearch && <button type="button" onClick={() => setProfessorSearch("")}>Clear</button>}</div>
            <p className="professor-search-hint">Results show only your assigned courses, organized as Program → Course → Professor.</p>
            <div className="professor-results" aria-live="polite">
              {matchingDirectoryCourseCount ? matchingDirectoryPrograms.map((group) => <section className="program-result-group" key={group.program}>
                <header className="program-result-group__header"><div><small>PROGRAM</small><h2>{group.program}</h2></div><span>{group.courses.length} {group.courses.length === 1 ? "course" : "courses"}</span></header>
                <div className="program-result-group__courses">{group.courses.map((item) => {
                  const isAssigned = courses.some((course) => String(course.id) === String(item.id));
                  const isComplete = completedIds.includes(String(item.id));
                  const statusLabel = isComplete ? "Completed" : isAssigned ? "Ready to evaluate" : "Not assigned";
                  const statusClass = isComplete ? "status--complete" : isAssigned ? "status--active" : "status--upcoming";

                  return <article className="professor-result" key={item.id}>
                    <span className="professor-result__avatar">{item.initials}</span>
                    <div className="professor-result__course"><small>COURSE · {item.code}</small><h3>{item.course}</h3></div>
                    <span className="professor-result__arrow" aria-hidden="true">›</span>
                    <div className="professor-result__teacher"><small>PROFESSOR</small><strong>{item.professor}</strong><span className={`status ${statusClass}`}>{statusLabel}</span></div>
                  </article>;
                })}</div>
              </section>) : <div className="professor-no-results"><span>⌕</span><strong>No matching professors, programs, or courses</strong><p>Try a professor’s last name, program name, course title, or code.</p></div>}
            </div>
            <div className="notice notice--info student-demo-notice professor-directory-note"><span>ⓘ</span><p>These are the professors assigned to your courses. You can check each evaluation’s status here or under <strong>My evaluations</strong>.</p></div>
          </section>}

          {page === "Profile" && <section className="subpage"><div className="student-section-heading"><div><p className="eyebrow"><span className="eyebrow__dot" /> STUDENT RECORD</p><h1>My profile</h1><p>Your enrollment details and courses for this account.</p></div></div><article className="panel student-profile-card"><div className="student-profile-card__identity"><span className="student-profile-card__avatar">{student.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span><div><p className="eyebrow">OLOPSC STUDENT</p><h2>{student.name}</h2><p>Student ID · {student.studentId}</p></div><span className="status status--active">Active student</span></div><div className="student-profile-details"><ProfileDetail label="Date enrolled" value={student.enrollmentDate} /><ProfileDetail label="Year level" value={student.yearLevel} /><ProfileDetail label="Course / program" value={student.program} /><ProfileDetail label="School year" value="2026–2027" /></div></article><section className="student-profile-courses"><div className="student-section-heading"><div><p className="eyebrow"><span className="eyebrow__dot" /> CURRENT ENROLLMENT</p><h2>Courses and professors</h2><p>Courses assigned to this student account for the current evaluation period.</p></div><span className="student-course-total">{courses.length} courses</span></div><div className="student-profile-course-list">{courses.map((course) => <article className="student-profile-course" key={course.id}><span className="student-profile-course__avatar">{course.initials}</span><div><small>{course.code} · {course.program}</small><h3>{course.course}</h3></div><div className="student-profile-course__professor"><small>Professor</small><strong>{course.teacher}</strong></div></article>)}</div></section></section>}

          {selectedCourse && evaluationStep === "guide" && <section className="subpage">
            <div className="page-heading">
              <div><p className="eyebrow"><span className="eyebrow__dot" /> MIDTERM FACULTY EVALUATION · STEP 1 OF 2</p><h1>How this survey works</h1><p className="page-heading__description">Take a moment to understand the questions before you begin.</p></div>
              <span className="status status--active">Open until Nov 27</span>
            </div>
            <article className="panel survey-guide-card">
              <div className="teacher-heading"><span className="avatar avatar--large">{selectedCourse.initials}</span><div><h2>{selectedCourse.teacher}</h2><p>{selectedCourse.course} · {selectedCourse.code}</p></div><span className="step-indicator">1 <span>/ 2</span></span></div>
              <div className="form-divider" />
              <div className="survey-guide-steps">
                <article><span>01</span><div><strong>Think about your experience</strong><p>Consider the course across the semester, including lessons, class discussions, and feedback.</p></div></article>
                <article><span>02</span><div><strong>Rate five teaching statements</strong><p>Choose one response for every statement, from 1 “Needs work” to 5 “Excellent.”</p></div></article>
                <article><span>03</span><div><strong>Add a comment if you want</strong><p>Comments are optional. Specific, respectful suggestions can make your feedback more useful.</p></div></article>
                <article><span>04</span><div><strong>Review, then submit</strong><p>All five ratings are required. If any are missing, the survey will point them out so you can finish.</p></div></article>
              </div>
              <div className="form-actions"><button className="button button--secondary" type="button" onClick={() => setSelectedCourse(null)}>← Back to my evaluations</button><button className="button button--primary" type="button" onClick={() => setEvaluationStep("survey")}>Continue to survey <span>→</span></button></div>
            </article>
          </section>}

          {selectedCourse && evaluationStep === "survey" && <section className="subpage">
            <div className="page-heading">
              <div><p className="eyebrow"><span className="eyebrow__dot" /> MIDTERM FACULTY EVALUATION · STEP 2 OF 2</p><h1>Evaluate your course</h1><p className="page-heading__description">Rate each statement based on your experience in this course.</p></div>
              <span className="status status--active">Open until Nov 27</span>
            </div>
            <article className="panel evaluation-card student-evaluation-card">
              <button className="text-link back-link" type="button" onClick={() => setEvaluationStep("guide")}>← Back to survey guide</button>
              <div className="teacher-heading"><span className="avatar avatar--large">{selectedCourse.initials}</span><div><h2>{selectedCourse.teacher}</h2><p>{selectedCourse.course} · {selectedCourse.code}</p></div><span className="step-indicator">2 <span>/ 2</span></span></div>
              <div className="form-divider" />
              <h3>Teaching and learning</h3><p className="section-copy">Select one rating for each statement. Comments are optional.</p>
              <form onSubmit={submitEvaluation}>
                {showValidation && <div className="survey-validation" role="alert"><span aria-hidden="true">!</span><p><strong>Survey incomplete</strong>Please answer all five statements. {missingRatingCount} {missingRatingCount === 1 ? "rating is" : "ratings are"} still missing.</p></div>}
                {criteria.map((criterion, index) => {
                  const unanswered = showValidation && !ratings[index];
                  return <fieldset className={`rating-field ${unanswered ? "is-incomplete" : ""}`} key={criterion} aria-invalid={unanswered || undefined}>
                    <legend><span>{String(index + 1).padStart(2, "0")}</span>{criterion}</legend>
                    <div className="rating-options" aria-label={`Rating for ${criterion}`}>
                      {[1, 2, 3, 4, 5].map((score) => <button key={score} type="button" className={`rating-option ${ratings[index] === score ? "is-selected" : ""}`} aria-pressed={ratings[index] === score} onClick={() => rateCriterion(index, score)}><strong>{score}</strong><small>{["Needs work", "Fair", "Good", "Very good", "Excellent"][score - 1]}</small></button>)}
                    </div>
                    {unanswered && <p className="rating-field__error">Choose one rating for this statement.</p>}
                  </fieldset>;
                })}
                <label className="comment-field">Additional comments <span>Optional</span><textarea name="comment" rows={4} maxLength={600} placeholder="Share a specific example or suggestion that could help..." /></label>
                <div className="comment-identity-note">In the live system, administrators can see who submitted each evaluation and all results. Professors can see comments for their courses, but not ratings; your name appears with a comment only if you select the option below.</div>
                <label className="comment-identity-option"><input type="checkbox" name="identifyComment" /> <span><strong>Show my name to this professor with my comment</strong><small>Leave unchecked to keep your comment anonymous to the professor. This applies only if you leave a comment.</small></span></label>
                <div className="form-actions"><button className="button button--secondary" type="button" onClick={() => setEvaluationStep("guide")}>← Back to guide</button><button className="button button--primary" type="submit">Submit evaluation <span>→</span></button></div>
              </form>
            </article>
          </section>}
        </div>
      </main>

      {toast && <div className="toast" role="status" aria-live="polite">{toast}<button type="button" aria-label="Dismiss message" onClick={() => setToast("")}>×</button></div>}
    </div>
  );
}

function StudentCourseCard({ course, complete, onStart }: { course: Course; complete: boolean; onStart: () => void }) {
  return <article className={`student-course-card ${complete ? "is-complete" : ""}`}><div className="student-course-card__avatar">{complete ? "✓" : course.initials}</div><div className="student-course-card__info"><div className="student-course-card__eyebrow"><span>{course.code}</span><i /> <span>Midterm evaluation</span></div><h3>{course.course}</h3><p>{course.teacher} <span>·</span> {course.program}</p></div><span className={`status ${complete ? "status--complete" : "status--active"}`}>{complete ? "Completed" : "Ready"}</span><button className={`button ${complete ? "button--secondary" : "button--primary"} button--small`} type="button" onClick={onStart} disabled={complete}>{complete ? "Submitted" : "Start evaluation"}{!complete && <span aria-hidden="true">→</span>}</button></article>;
}

function ProfileDetail({ label, value }: { label: string; value: string }) {
  return <div className="student-profile-detail"><small>{label}</small><strong>{value}</strong></div>;
}
