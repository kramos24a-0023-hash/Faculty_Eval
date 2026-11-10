# OLOPSC Faculty Evaluation

The faculty evaluation app is built with Next.js App Router, React, and TypeScript. It includes administrator results, student evaluation, and professor comment views.

The first screen is a school-account sign-in page branded for OLOPSC. It accepts only `@olopsc.edu.ph` email addresses; there are no browser-only sample credentials.

## Run locally

Use Node.js 20.9 or later.

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in a browser. You can also use `pnpm install` and `pnpm dev`.

## Supabase connection setup

Copy `.env.example` to `.env.local` and fill in the project URL and publishable key from the Supabase dashboard. The local `.env.local` is ignored by Git. Supabase browser and server client helpers are available in `lib/supabase/` and use `@supabase/ssr` for cookie-based sessions.

The database migrations are in `supabase/migrations/`. The first migration sets up the schema and privacy policies. The second allows only OLOPSC-domain accounts to be created and adds school-email checks to sensitive student-data policies. Both migrations have been applied to `Faculty_Eval`. All 11 public tables have Row Level Security enabled.

## Live Supabase flow

School accounts sign in through Supabase Auth. Student schedules, professor assignments, periods, criteria, and completion status are read from the database. Submissions use the `submit_course_evaluation` database function, which validates the student, course assignment, open period, and every required rating. Admins see identified submissions and ratings; professors see comments only for their assigned courses.

Password recovery sends a Supabase Auth reset email and exchanges its one-time code at `/auth/callback` before allowing a new password. Add `https://faculty-eval.vercel.app/auth/callback` and `http://localhost:3000/auth/callback` to the Supabase project's **Authentication → URL Configuration → Redirect URLs** allow list. The recovery email template should retain Supabase's `{{ .ConfirmationURL }}` link.

For production email delivery, configure a custom SMTP provider in **Authentication → SMTP Settings**. Supabase's built-in sender is restricted to project-team addresses and has a very low sending limit, so it cannot reliably deliver password resets to school accounts. Keep SMTP credentials in the Supabase dashboard; never add them to this repository or client environment variables.

After applying migration 2, create the administrator account in Supabase Dashboard under **Authentication → Users → Add user**, using `kramos24a-0023@olopsc.edu.ph` and a password you enter there. That address is assigned the admin role automatically; new school accounts default to student until an administrator changes their role.

Keep self-registration disabled in Supabase Auth so school accounts are provisioned by an administrator. The school administrator must populate programs, courses, professor accounts and course assignments, evaluation periods, criteria, and student records/enrollments. These records determine what appears in each account.
