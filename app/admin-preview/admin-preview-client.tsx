"use client";

import Dashboard from "../dashboard";

export default function AdminPreviewClient() {
  return (
    <>
      <div style={{ padding: "10px 20px", background: "#fff4cc", color: "#624b00", textAlign: "center", fontSize: 14, fontWeight: 700 }}>
        LOCAL ADMIN PREVIEW · Sample data only · Changes stay in this browser session
      </div>
      <Dashboard />
    </>
  );
}
