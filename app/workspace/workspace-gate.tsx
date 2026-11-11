"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import StudentDashboard, { type StudentAccess } from "../student-dashboard";
import Dashboard from "../dashboard";
import { createClient } from "../../lib/supabase/client";

type Access = StudentAccess & { email?: string; role?: string };

export default function WorkspaceGate({ requiredRole = "admin" }: { requiredRole?: "admin" | "student" | "professor" }) {
  const router = useRouter();
  const [access, setAccess] = useState<Access | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    async function loadAccess() {
      try {
        const supabase = createClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) { router.replace("/"); return; }
        const { data: profile, error: profileError } = await supabase.from("profiles").select("full_name, role").eq("id", user.id).maybeSingle();
        if (profileError || !profile || profile.role !== requiredRole) { router.replace("/"); return; }
        if (profile.role !== "student") {
          if (active) setAccess({ name: profile.full_name, email: user.email, role: profile.role, studentId: "", enrollmentDate: "", program: "", yearLevel: "", isSupabaseUser: true });
          return;
        }

        const { data: record, error: recordError } = await supabase.from("student_records").select("school_student_id, enrollment_date, year_level, program_id").eq("student_id", user.id).maybeSingle();
        if (recordError || !record) throw new Error("Your student record is not linked yet.");
        const [programResult, periodResult] = await Promise.all([
          record.program_id ? supabase.from("programs").select("name, department").eq("id", record.program_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
          supabase.from("evaluation_periods").select("id, name, ends_at, is_open").eq("is_open", true).lte("starts_at", new Date().toISOString()).gte("ends_at", new Date().toISOString()).order("ends_at", { ascending: true }).limit(1).maybeSingle(),
        ]);
        const period = periodResult.data;
        let courses: StudentAccess["courses"] = [];
        let criteria: StudentAccess["criteria"] = [];
        let completedCourseIds: (string | number)[] = [];
        if (period) {
          const { data: enrollments, error: enrollmentError } = await supabase.from("student_enrollments").select("course_id, courses(id, code, name, program_id)").eq("student_id", user.id).eq("period_id", period.id);
          if (enrollmentError) throw enrollmentError;
          const courseRows = (enrollments ?? []).map((row: any) => row.courses).filter(Boolean);
          const courseIds = courseRows.map((course: any) => course.id);
          const [professorResult, directoryInstructorResult, criterionResult, submissionResult, programNamesResult] = await Promise.all([
            courseIds.length ? supabase.from("course_professors").select("course_id, professor_id, profiles(full_name)").in("course_id", courseIds) : Promise.resolve({ data: [], error: null }),
            courseIds.length ? supabase.from("course_instructors").select("course_id, instructors(full_name)").in("course_id", courseIds) : Promise.resolve({ data: [], error: null }),
            supabase.from("evaluation_criteria").select("id, prompt").eq("period_id", period.id).eq("is_active", true).order("sort_order"),
            supabase.from("evaluation_submissions").select("course_id").eq("student_id", user.id).eq("period_id", period.id),
            supabase.from("programs").select("id, name, department"),
          ]);
          if (professorResult.error || directoryInstructorResult.error || criterionResult.error || submissionResult.error || programNamesResult.error) throw new Error("Could not load your evaluation schedule.");
          const instructorsByCourse = new Map<string, string[]>();
          for (const item of professorResult.data ?? []) {
            const person = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;
            if (!person?.full_name) continue;
            instructorsByCourse.set(item.course_id, [...(instructorsByCourse.get(item.course_id) ?? []), person.full_name]);
          }
          for (const item of directoryInstructorResult.data ?? []) {
            const person = Array.isArray(item.instructors) ? item.instructors[0] : item.instructors;
            if (!person?.full_name) continue;
            const current = instructorsByCourse.get(item.course_id) ?? [];
            if (!current.includes(person.full_name)) instructorsByCourse.set(item.course_id, [...current, person.full_name]);
          }
          const programNames = new Map((programNamesResult.data ?? []).map((p: any) => [p.id, [p.department, p.name].filter(Boolean).join(" · ")]));
          courses = courseRows.map((course: any) => {
            const teacher = instructorsByCourse.get(course.id)?.join(", ") ?? "Professor not assigned";
            return { id: course.id, periodId: period.id, course: course.name, code: course.code, teacher, initials: teacher.split(/[ ,]+/).filter(Boolean).slice(0, 2).map((part: string) => part[0]).join("").toUpperCase(), program: String(programNames.get(course.program_id) ?? "OLOPSC") };
          });
          criteria = criterionResult.data ?? [];
          completedCourseIds = (submissionResult.data ?? []).map((row: any) => row.course_id);
        }
        const enrollmentDate = record.enrollment_date ? new Date(`${record.enrollment_date}T00:00:00`).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }) : "Not provided";
        if (active) setAccess({ name: profile.full_name, email: user.email, role: profile.role, studentId: record.school_student_id, enrollmentDate, program: programResult.data ? [programResult.data.department, programResult.data.name].filter(Boolean).join(" · ") : "Program not assigned", yearLevel: record.year_level ?? "Not provided", courses, criteria, completedCourseIds, periodId: period?.id, periodName: period?.name, periodEnd: period?.ends_at, periodIsOpen: period?.is_open, isSupabaseUser: true });
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : "Could not load your school account.");
      }
    }
    void loadAccess();
    return () => { active = false; };
  }, [requiredRole, router]);

  async function signOut() {
    try { await createClient().auth.signOut(); } catch { /* Continue to the sign-in page if Supabase is unavailable. */ }
    router.replace("/");
  }

  if (message) return <main className="workspace-checking">{message} Please contact your school administrator.</main>;
  if (!access) return <main className="workspace-checking">Checking school access…</main>;
  if (requiredRole === "student") return <StudentDashboard onLogout={signOut} student={access} />;
  if (requiredRole === "admin") return <><div role="status" style={{ padding: "10px 16px", background: "#fff4d6", color: "#644b00", textAlign: "center", fontSize: 13 }}>Demo data · Changes on this admin screen are temporary and are not saved.</div><Dashboard onLogout={signOut} adminName={access.name ?? "System admin"} /></>;
  return <ProfessorComments onLogout={signOut} />;
}

function ProfessorComments({ onLogout }: { onLogout: () => void }) {
  const [comments, setComments] = useState<{ id: string; body: string; professor_visible_name: string | null; created_at: string; courses: { name: string; code: string }[] | null }[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void createClient().from("evaluation_comments").select("id, body, professor_visible_name, created_at, courses(name, code)").order("created_at", { ascending: false }).then(({ data, error: queryError }) => {
      if (!active) return;
      if (queryError) setError("Comments could not be loaded.");
      else setComments(data ?? []);
    });
    return () => { active = false; };
  }, []);
  return <main className="workspace-checking" style={{ display: "block", padding: 32, background: "#f4f7fb", color: "#26364d" }}><header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><h1>Professor comments</h1><button className="button button--secondary" onClick={onLogout}>Log out</button></header><p>Comments are shown only for courses assigned to your professor account. Ratings and student identities are hidden; comments display a name only when the student chose to share it.</p>{error && <p role="alert">{error}</p>}{comments.length ? comments.map((comment) => <article className="panel" key={comment.id} style={{ margin: "16px 0", padding: 20 }}><small>{comment.courses?.[0] ? `${comment.courses[0].code} · ${comment.courses[0].name}` : "Course"}</small><p>{comment.body}</p><small>{comment.professor_visible_name ?? "Anonymous student"}</small></article>) : !error && <p>No comments are available for your courses yet.</p>}</main>;
}
