"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../lib/supabase/client";

type Course = { id: string; code: string; name: string };
type Period = { id: string; name: string; semester: string; school_year: string };
type Question = { id?: string; prompt: string; section: string; survey_group: string; sort_order: number };
type Criterion = Question & { id: string; course_id: string | null; is_active: boolean };

export default function QuestionnaireManager() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [periodId, setPeriodId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [custom, setCustom] = useState(false);
  const [hasSurveyResponses, setHasSurveyResponses] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void Promise.all([
      createClient().from("evaluation_periods").select("id,name,semester,school_year").order("starts_at", { ascending: false }),
      createClient().from("courses").select("id,code,name").order("code"),
    ]).then(([periodResult, courseResult]) => {
      if (!active) return;
      if (periodResult.error || courseResult.error) setError("Could not load evaluation periods or subjects.");
      else {
        setPeriods(periodResult.data ?? []);
        setCourses(courseResult.data ?? []);
        setPeriodId(periodResult.data?.[0]?.id ?? "");
        setCourseId(courseResult.data?.[0]?.id ?? "");
      }
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!periodId || !courseId) return;
    let active = true;
    setLoading(true);
    void createClient().from("evaluation_criteria").select("id,course_id,prompt,section,survey_group,sort_order,is_active").eq("period_id", periodId).eq("is_active", true).order("sort_order").then((criterionResult) => {
      if (!active) return;
      if (criterionResult.error) setError("Could not load this subject’s survey.");
      else {
        const rows = criterionResult.data ?? [];
        const own = rows.filter((row) => row.course_id === courseId);
        setCriteria(rows);
        setCustom(own.length > 0);
        setQuestions((own.length ? own : rows.filter((row) => !row.course_id)).map((row) => ({ id: own.length ? row.id : undefined, prompt: row.prompt, section: row.section ?? "Faculty evaluation", survey_group: row.survey_group ?? row.section ?? "Faculty evaluation", sort_order: row.sort_order })));
        const customIds = own.map((row) => row.id);
        if (!customIds.length) setHasSurveyResponses(false);
        else void createClient().from("evaluation_ratings").select("criterion_id").in("criterion_id", customIds).then(({ data: answers, error: answerError }) => {
          if (!active) return;
          if (answerError) setError("Could not check whether this survey already has responses.");
          else setHasSurveyResponses((answers ?? []).length > 0);
        });
        setError("");
        setNotice("");
      }
      setLoading(false);
    });
    return () => { active = false; };
  }, [periodId, courseId]);

  const courseLabel = useMemo(() => courses.find((course) => course.id === courseId), [courses, courseId]);
  const effectiveRows = custom ? questions : criteria.filter((row) => !row.course_id).map((row) => ({ id: row.id, prompt: row.prompt, section: row.section ?? "Faculty evaluation", survey_group: row.survey_group ?? row.section ?? "Faculty evaluation", sort_order: row.sort_order }));

  function customize() {
    setQuestions(criteria.filter((row) => !row.course_id).map((row) => ({ prompt: row.prompt, section: row.section ?? "Faculty evaluation", survey_group: row.survey_group ?? row.section ?? "Faculty evaluation", sort_order: row.sort_order })));
    setCustom(true);
    setNotice("This subject now has a separate editable copy. Save it to make it active for students.");
  }

  function update(index: number, field: "prompt" | "section" | "survey_group", value: string) {
    setQuestions((rows) => rows.map((row, i) => i === index ? { ...row, [field]: value } : row));
  }

  async function save() {
    if (!custom || hasSurveyResponses) return;
    if (questions.some((question) => !question.prompt.trim() || !question.section.trim() || !question.survey_group.trim())) {
      setError("Every question needs text, a section, and a group.");
      return;
    }
    if (!questions.length) { setError("Keep at least one active question in the survey."); return; }
    setSaving(true); setError(""); setNotice("");
    const db = createClient();
    const keepIds = questions.flatMap((question) => question.id ? [question.id] : []);
    const oldIds = criteria.filter((row) => row.course_id === courseId).map((row) => row.id);
    const removedIds = oldIds.filter((id) => !keepIds.includes(id));
    if (removedIds.length) {
      const { error: deactivateError } = await db.from("evaluation_criteria").update({ is_active: false }).in("id", removedIds);
      if (deactivateError) { setError(deactivateError.message); setSaving(false); return; }
    }
    const rows = questions.map((question) => ({
      id: question.id ?? crypto.randomUUID(),
      period_id: periodId,
      course_id: courseId,
      prompt: question.prompt.trim(),
      section: question.section.trim(),
      survey_group: question.survey_group.trim(),
      sort_order: question.sort_order,
      is_active: true,
    }));
    const { data: savedRows, error: saveError } = await db.from("evaluation_criteria").upsert(rows, { onConflict: "id" }).select("id,course_id,prompt,section,survey_group,sort_order,is_active");
    if (saveError) { setError(saveError.message.includes("responses already exist") ? "This survey can no longer be changed because responses have already been submitted." : saveError.message); setSaving(false); return; }
    setCriteria((current) => [...current.filter((row) => row.course_id !== courseId), ...(savedRows ?? [])]);
    setQuestions((savedRows ?? []).map((row) => ({ id: row.id, prompt: row.prompt, section: row.section ?? "Faculty evaluation", survey_group: row.survey_group ?? row.section ?? "Faculty evaluation", sort_order: row.sort_order })));
    setSaving(false);
    setNotice("Subject survey saved. Students enrolled in this course will now receive these questions.");
  }

  async function useStandardSurvey() {
    if (hasSurveyResponses) return;
    const ownIds = criteria.filter((row) => row.course_id === courseId).map((row) => row.id);
    if (!ownIds.length) return;
    setSaving(true);
    const { error: resetError } = await createClient().from("evaluation_criteria").update({ is_active: false }).in("id", ownIds);
    setSaving(false);
    if (resetError) { setError(resetError.message.includes("responses already exist") ? "This survey can no longer be changed because responses have already been submitted." : resetError.message); return; }
    setCriteria((current) => current.filter((row) => row.course_id !== courseId));
    setQuestions(criteria.filter((row) => !row.course_id).map((row) => ({ id: row.id, prompt: row.prompt, section: row.section ?? "Faculty evaluation", survey_group: row.survey_group ?? row.section ?? "Faculty evaluation", sort_order: row.sort_order })));
    setCustom(false);
    setNotice("This subject now uses the standard questionnaire.");
  }

  return <section className="subpage">
    <div className="page-heading"><div><p className="eyebrow"><span className="eyebrow__dot" /> EVALUATION SETUP</p><h1>Subject questionnaires</h1><p className="page-heading__description">Give each course its own survey. Students will answer the questions for the subject they are evaluating.</p></div></div>
    <article className="panel questionnaire-manager">
      <div className="questionnaire-selectors">
        <label className="form-field">Evaluation period<select value={periodId} onChange={(event) => setPeriodId(event.target.value)}>{periods.map((period) => <option key={period.id} value={period.id}>{period.name} · {period.school_year} · {period.semester}</option>)}</select></label>
        <label className="form-field">Subject<select value={courseId} onChange={(event) => setCourseId(event.target.value)}>{courses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.name}</option>)}</select></label>
      </div>
      {courseLabel && <div className="notice notice--info"><span>ⓘ</span><p><strong>{courseLabel.code} · {courseLabel.name}</strong> {custom ? "has its own questionnaire." : "uses the standard questionnaire."}{hasSurveyResponses && " Responses have been submitted to this course-specific survey, so its questions are locked to protect those results."}</p></div>}
      {error && <div className="notice notice--error" role="alert"><span>!</span><p>{error}</p></div>}
      {notice && <div className="notice notice--info" role="status"><span>✓</span><p>{notice}</p></div>}
      {!custom && <div className="questionnaire-toolbar"><p>Students in this course currently receive the shared standard survey ({effectiveRows.length} questions).</p><button className="button button--primary" type="button" disabled={loading || hasSurveyResponses} onClick={customize}>Create course survey</button></div>}
      {custom && <><div className="questionnaire-toolbar"><p>{questions.length} active questions · Changes lock once students answer this course-specific survey.</p><div className="questionnaire-toolbar__actions"><button className="button button--secondary" type="button" disabled={saving || hasSurveyResponses} onClick={useStandardSurvey}>Use standard survey</button><button className="button button--secondary" type="button" disabled={saving || hasSurveyResponses} onClick={() => setQuestions((rows) => [...rows, { prompt: "", section: "Instructional Component", survey_group: "Instructional Component", sort_order: Math.max(0, ...rows.map((row) => row.sort_order)) + 1 }])}>＋ Add question</button><button className="button button--primary" type="button" disabled={saving || hasSurveyResponses} onClick={() => void save()}>{saving ? "Saving…" : "Save questionnaire"}</button></div></div>
        <div className="questionnaire-question-list">{questions.map((question, index) => <article className="questionnaire-question" key={question.id ?? `new-${index}`}><div className="questionnaire-question__number">{String(index + 1).padStart(2, "0")}</div><div className="questionnaire-question__fields"><label className="form-field">Question<textarea rows={2} value={question.prompt} disabled={hasSurveyResponses} onChange={(event) => update(index, "prompt", event.target.value)} /></label><div className="form-grid"><label className="form-field">Section<input value={question.section} disabled={hasSurveyResponses} onChange={(event) => update(index, "section", event.target.value)} /></label><label className="form-field">Survey group<input value={question.survey_group} disabled={hasSurveyResponses} onChange={(event) => update(index, "survey_group", event.target.value)} /></label></div></div><button className="button button--secondary button--small" type="button" disabled={hasSurveyResponses} onClick={() => setQuestions((rows) => rows.filter((_, i) => i !== index))}>Remove</button></article>)}{!questions.length && <p className="empty-state">No questions yet. Add a question to build the subject survey.</p>}</div>
      </>}
      {!custom && <div className="questionnaire-standard-list">{effectiveRows.map((question, index) => <article key={question.id}><strong>{String(index + 1).padStart(2, "0")}</strong><div><small>{question.section} · {question.survey_group}</small><p>{question.prompt}</p></div></article>)}</div>}
      {loading && <p role="status">Loading questionnaire…</p>}
      {!periods.length && !loading && <p className="empty-state">Create an evaluation period before managing its questionnaire.</p>}
      {!courses.length && !loading && <p className="empty-state">No subjects are available yet.</p>}
    </article>
  </section>;
}
