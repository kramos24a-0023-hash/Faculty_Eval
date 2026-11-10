"use client";

import { useRouter } from "next/navigation";
import StudentDashboard, { type StudentAccess } from "../student-dashboard";

const sampleStudent: StudentAccess = {
  name: "Alex Rivera",
  studentId: "DEMO-2026",
  enrollmentDate: "June 10, 2024",
  program: "BS Information Technology",
  yearLevel: "3rd year",
  periodName: "Midterm · 1st semester",
  courses: [
    { id: "demo-web", course: "Web Application Development", code: "IT 302", teacher: "Daniel Reyes", initials: "DR", program: "BS Information Technology" },
    { id: "demo-db", course: "Database Management Systems", code: "IT 304", teacher: "Angela Santos", initials: "AS", program: "BS Information Technology" },
    { id: "demo-net", course: "Computer Networks", code: "IT 306", teacher: "Miguel Dela Cruz", initials: "MD", program: "BS Information Technology" },
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
