import { notFound } from "next/navigation";
import StudentPreviewClient from "./student-preview-client";

export default function StudentPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <StudentPreviewClient />;
}
