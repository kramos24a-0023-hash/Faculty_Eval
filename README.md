# OLOPSC Faculty Evaluation

The faculty evaluation app is built with Next.js App Router, React, and TypeScript. It includes administrator results, student evaluation, and professor comment views.

The first screen is a sign-in page branded for OLOPSC. The sign-in and password reset forms accept any valid email address. Student and professor accounts must use `@olopsc.edu.ph`; administrator accounts must be explicitly provisioned from the private admin email allowlist. There are no browser-only sample credentials.

## Run locally

Use Node.js 20.9 or later.

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in a browser. You can also use `pnpm install` and `pnpm dev`.

## Supabase connection setup

Copy `.env.example` to `.env.local` and fill in the project URL and publishable key from the Supabase dashboard. The local `.env.local` is ignored by Git. Supabase browser and server client helpers are available in `lib/supabase/` and use `@supabase/ssr` for cookie-based sessions.

The database migrations are in `supabase/migrations/`. The first migration sets up the schema and privacy policies. The second restricts new accounts to OLOPSC-domain addresses and adds school-email checks to sensitive student-data policies. The third allows administrator profiles to retain admin access with a personal email; the fourth adds a private allowlist for personal-email administrator accounts; the fifth restricts auth trigger functions to trigger execution. Student and professor access remains school-domain restricted. All 11 public tables have Row Level Security enabled.

## Live Supabase flow

School accounts sign in through Supabase Auth. Student schedules, professor assignments, periods, criteria, and completion status are read from the database. Submissions use the `submit_course_evaluation` database function, which validates the student, course assignment, open period, and every required rating. Admins see identified submissions and ratings; professors see comments only for their assigned courses.

Password recovery sends a Supabase Auth reset email and verifies it at `/auth/callback` before allowing a new password. The callback accepts both Supabase's PKCE code and a one-time recovery token, so recovery links can work when opened on another device. Add `https://faculty-eval.vercel.app/auth/callback` and `http://localhost:3000/auth/callback` to the Supabase project's **Authentication → URL Configuration → Redirect URLs** allow list. For cross-device recovery, set the **Reset Password** email template link to:

```html
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery">Reset password</a>
```

For production email delivery, enable custom SMTP in **Authentication → SMTP Settings**. The current Supabase project has custom SMTP disabled. Auth logs show earlier Resend attempts failing because the sender used an unverified `gmail.com` domain. Verify a domain you control with the email provider, configure its DNS records there, and use an address on that verified domain as the sender in Supabase. Supabase's built-in sender is restricted to project-team addresses and has a very low sending limit, so it cannot reliably deliver password resets to school accounts. Keep SMTP credentials in the Supabase dashboard; never add them to this repository or client environment variables.

The initial administrator at `kramos24a-0023@olopsc.edu.ph` is assigned the admin role automatically. Personal-email administrators must be added to the private allowlist before creating their user in Supabase Dashboard under **Authentication → Users → Add user**. They receive the admin role automatically; the person creating the account enters its password. New OLOPSC accounts default to student until an administrator changes their role.

Keep self-registration disabled in Supabase Auth so school accounts are provisioned by an administrator. The school administrator must populate programs, courses, professor accounts and course assignments, evaluation periods, criteria, and student records/enrollments. These records determine what appears in each account.
