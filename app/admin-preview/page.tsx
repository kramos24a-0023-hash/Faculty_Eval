import { notFound } from "next/navigation";
import AdminPreviewClient from "./admin-preview-client";

export default function AdminPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <AdminPreviewClient />;
}
