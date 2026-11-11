"use client";

import { useRouter } from "next/navigation";
import StudentDashboard, { type StudentAccess } from "../student-dashboard";

const sampleStudent: StudentAccess = {
  name: "Alex Rivera",
  studentId: "DEMO-2026",
  enrollmentDate: "June 10, 2024",
  program: "Computing Studies · Computer Science",
  yearLevel: "2nd year",
  periodName: "Midterm · 1st semester",
  courses: [
    { id: "demo-cc104", course: "Data Structures and Algorithms", code: "CC104", teacher: "Mr. Rame Tiongson", initials: "RT", program: "Computing Studies · Computer Science" },
    { id: "demo-ds102", course: "Discrete Structures 2", code: "DS102", teacher: "Ms. Apasra Somo", initials: "AS", program: "Computing Studies · Computer Science" },
    { id: "demo-ege10", course: "Science, Technology and Society", code: "EGE10", teacher: "Ms. Fleur Rivera", initials: "FR", program: "Computing Studies · Computer Science" },
    { id: "demo-hmge11", course: "Panitikan", code: "HMGE11", teacher: "Ms. Anabelle Nase", initials: "AN", program: "Computing Studies · Computer Science" },
    { id: "demo-im101", course: "Fundamentals of Database Systems", code: "IM101", teacher: "Ms. Ruby Cruz", initials: "RC", program: "Computing Studies · Computer Science" },
    { id: "demo-pathfit3", course: "Dance", code: "PATHFIT 3", teacher: "Mr. Xavier Pillas", initials: "XP", program: "Computing Studies · Computer Science" },
    { id: "demo-sdf104", course: "Object-Oriented Programming", code: "SDF104", teacher: "Mr. Rame Tiongson", initials: "RT", program: "Computing Studies · Computer Science" },
  ],
  criteria: [
    { id: "demo-1", prompt: "Explains course concepts clearly" },
    { id: "demo-2", prompt: "Encourages questions and discussion" },
    { id: "demo-3", prompt: "Provides useful feedback on student work" },
    { id: "demo-4", prompt: "Uses class time and learning materials effectively" },
    { id: "demo-5", prompt: "Treats students fairly and respectfully" },
  ],
};

export default function StudentPreviewClient() {
  const router = useRouter();
  return (
    <>
      <div style={{ padding: "10px 20px", background: "#fff4cc", color: "#624b00", textAlign: "center", fontSize: 14, fontWeight: 700 }}>
        LOCAL PREVIEW · Sample student data only · No real account or submissions
      </div>
      <StudentDashboard student={sampleStudent} onLogout={() => router.push("/")} />
    </>
  );
}
