import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Faculty Evaluation | Our Lady Of Perpetual Succor College of Business Management, Science and Education",
  description: "Faculty evaluation and academic insights workspace for Our Lady Of Perpetual Succor College of Business Management, Science and Education.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
