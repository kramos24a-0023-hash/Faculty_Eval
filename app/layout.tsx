import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Faculty Evaluation | OLOPSC",
  description: "OLOPSC faculty evaluation and academic insights workspace.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
