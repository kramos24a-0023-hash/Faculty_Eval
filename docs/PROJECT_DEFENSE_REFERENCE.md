# OLOPSC Faculty Evaluation System

## Project defense and implementation reference

**System:** Our Lady of Perpetual Succor College of Business Management, Science and Education Faculty Evaluation System  
**Production site:** [faculty-eval.vercel.app](https://faculty-eval.vercel.app)  
**Repository:** [kramos24a-0023-hash/Faculty_Eval](https://github.com/kramos24a-0023-hash/Faculty_Eval)  
**Backend:** Supabase project `Faculty_Eval` (`ddketgkichmdsslxpxdd`)  
**Reference checked:** November 18, 2026

> This guide describes the implementation found in the project and the live service checks made on the date above. It does not claim that unperformed user testing or unconfigured email delivery has passed.

## 1. What the system does

The system lets students evaluate the professors assigned to their courses during an open evaluation period. It lets administrators manage school data and review participation, ratings, and comments. Professors can read comments for courses assigned to them; they do not see student identities unless a student chose to attach their name to a comment.

Students sign in to an account provisioned by an administrator. There is no sign-up page or sign-up action in the website. The app includes a forgot-password flow, grouped survey questions, saved drafts, a 1–5 rating scale, optional comments, and a submission confirmation.

## 2. How the parts connect

```text
Student / administrator / professor browser
                 │
                 ▼
Next.js + React + TypeScript website
  ├─ App Router pages and role-specific workspaces
  ├─ Supabase SSR browser/server clients
  └─ auth proxy refreshes the session cookies
                 │  HTTPS requests using the public publishable key
                 ▼
Supabase Auth + PostgreSQL + Row Level Security
  ├─ verifies the signed-in user
  ├─ filters data according to the user's role and assignments
  └─ validates and stores evaluation submissions atomically

GitHub main ── Vercel Git deployment ── production website
```

The bridge between the website and backend is Supabase's JavaScript client (`@supabase/supabase-js`) with its Next.js session adapter (`@supabase/ssr`). Browser and server helpers are in `lib/supabase/client.ts` and `lib/supabase/server.ts`. The server helper reads and writes the session through Next.js cookies. `proxy.ts` refreshes the Supabase session when needed. The site uses the Supabase publishable key; database access is limited by the signed-in user's session and database policies. A publishable key is expected in browser code; a service-role key must never be put there.

GitHub is the source repository. Vercel builds the Next.js project from the repository and serves the site. Supabase provides authentication, the database, and its authorization rules. Vercel does not replace Supabase; it hosts the front end and server routes that connect to it.

## 3. Main tools and technologies

| Part | Technology | Role in the system |
|---|---|---|
| User interface | React 19 and TypeScript 5 | Builds interactive pages and checks application types. |
| Web framework | Next.js 16 App Router | Routes, page rendering, callback route, and production build. |
| Authentication | Supabase Auth | Sign-in, session management, and password recovery. |
| Database | Supabase PostgreSQL | Stores school structure, assignments, periods, surveys, drafts, ratings, and comments. |
| Access control | PostgreSQL RLS and database functions | Enforces access at the data layer for every request. |
| Session integration | `@supabase/ssr` and `@supabase/supabase-js` | Connects the Next.js browser/server runtime to Supabase Auth and data. |
| Source control | GitHub | Stores source code and database migrations. |
| Hosting | Vercel | Builds and hosts the production web app from GitHub. |

Dependency versions are pinned in `package.json` and `package-lock.json` for consistent installs. The project expects Node.js 20.9 or later.

## 4. Main user journeys

### Student evaluation

1. The student signs in at `/` with an account created by the school administrator.
2. The workspace checks the authenticated user and loads the profile role. A student sees their program, year, current evaluation period, enrolled courses, and assigned professors from live database records.
3. The student searches or selects a course and completes its grouped questions. Each item is rated from 1 to 5. The survey can be saved as a draft and resumed later.
4. The student can add an optional comment and choose whether to share their name with the professor.
5. On submission, the database function checks authorization, enrollment, period status, question set, and rating values before writing the result. The app displays success or a message explaining that required items remain.

### Administrator review

The administrator workspace uses the same school programs, student records, courses, faculty assignments, evaluation periods, questions, and submissions as the student workflow. Administrators can review participation, statistics, and comments. Displayed teacher averages are calculated from submitted course evaluations for the selected period; if a teacher has two course evaluations, the teacher-level average is the mean of the submitted course-level averages.

### Professor comments

The professor view reads comments restricted by database policy to that professor's assigned courses. Student identity and ratings are not included in that professor view. A name appears only when the student elected to share it.

### Password recovery

1. The user selects **Forgot password?** and enters an email address.
2. The app calls Supabase Auth `resetPasswordForEmail` and directs the recovery link to `/auth/callback`.
3. The callback verifies the one-time recovery token or exchanges the PKCE code, then redirects without caching to `/reset-password`.
4. The user enters and confirms a new password. The app updates it through Supabase Auth and signs the recovery session out.

The app uses a neutral reset-request confirmation so the screen does not reveal whether an email address belongs to an account. However, production email delivery is currently not ready: the live project's custom SMTP is disabled, and the previous sender used an unverified `gmail.com` domain. The code path exists, but a real message to a school account cannot be confirmed until the school configures an email sender they control.

## 5. Data model and survey scoring

The database uses relational tables with UUID keys and foreign keys. The main records include:

- `profiles`, `student_records`, and `programs` for roles and student program/year information.
- `courses`, `course_professors`, `instructors`, and `course_instructors` for subjects and faculty assignments.
- `evaluation_periods`, `student_enrollments`, and `evaluation_criteria` for the active evaluation cycle and survey items.
- `evaluation_drafts` for a student's in-progress survey.
- `evaluation_submissions`, `evaluation_ratings`, and `evaluation_comments` for completed responses.

The survey criteria can be grouped into sections and assigned to individual courses, allowing different subjects taught by the same professor to have their own survey. Ratings are integers from 1 to 5. A course result is the arithmetic mean of its submitted item ratings. The professor's overall average for a period is the mean of the course-level results that have actually been submitted. Unsubmitted courses do not contribute a score. For example, if two course averages are 3.5 and 4.9, the combined average is `(3.5 + 4.9) / 2 = 4.2`.

## 6. Security and privacy design

- **No public sign-up interface:** the website contains sign-in and recovery screens, but no account-creation screen. Accounts are intended to be provisioned by an administrator. The live Supabase “Allow new users to sign up” toggle must still be checked in the project dashboard; it was not readable through the available project connection during this review.
- **Database-enforced access:** Row Level Security is enabled on the public data tables. Policies distinguish administrators, students, and professors; sensitive queries are not protected only by hiding front-end buttons.
- **Role checks use database profiles:** workspace code checks the signed-in user and profile role. Database policies repeat access checks so a user cannot gain permissions by editing browser state.
- **School-account controls:** migrations contain checks for school accounts and an administrator-managed allowlist for permitted provisioned addresses.
- **Atomic submission validation:** `submit_course_evaluation` validates signed-in student role, eligible enrollment, open evaluation period, expected active survey items, rating range, and comment length in one database transaction. It is `SECURITY DEFINER` so it can perform the controlled insert across protected tables; it uses a fixed empty search path, checks the user and enrollment itself, and execution is restricted to authenticated users. This deliberate design explains the Supabase advisor warning about a security-definer function being executable by authenticated users; it is not a public or anonymous submission endpoint.
- **Recovery links:** callback responses are marked `Cache-Control: no-store` and `Referrer-Policy: no-referrer` so one-time recovery values are not retained in caches or sent as referrer data.
- **HTTP response headers:** the app sets `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and a restrictive `Permissions-Policy`; production responses also set HSTS for the app host.
- **No secret keys in the browser:** the app uses the Supabase publishable key. Database migrations and public config belong in source control; SMTP credentials and any service-role key do not.
- **Comment privacy:** the professor policy limits comments to assigned courses. The comment may be anonymous, and the schema stores no student ID directly in the comment record; administrators can trace a comment through its submission.

### Live security review snapshot (November 18, 2026)

The Supabase project was active and the migration history matched the local migration set through `20261116142913`. The Security Advisor reported two items requiring attention:

1. **Leaked-password protection is disabled.** Turn it on in Supabase Authentication security settings.
2. **Authenticated execution of `submit_course_evaluation` is flagged.** The function is intentionally callable by signed-in users and enforces student eligibility and all submission constraints internally. Keep its public/anonymous execution revoked; review function changes and policies carefully when maintaining it.

The Performance Advisor also listed unindexed foreign keys and overlapping permissive policies. These are performance/maintainability findings rather than evidence that authorization is bypassed. Review query plans and consolidate equivalent policies in a separate database maintenance change; do not delete policies blindly because permissive policies combine with OR behavior.

## 7. What was checked for this reference

- Local repository was on `main` and had no unrelated user changes before the current changes.
- GitHub repository and connected account matched `kramos24a-0023-hash/Faculty_Eval`.
- The latest production Vercel deployment was ready and built from `main` commit `b59f026d22b455e6e688e22f29451a9fa5522534` before these local changes.
- Supabase project `Faculty_Eval` was active; its migration list matched the repository.
- Local code inspection confirmed login, recovery, callback, student, administrator, and professor routes, plus the absence of a sign-up control or `signUp` call.
- `npm run typecheck` passed after the current code changes.
- `npm run build -- --webpack` could not finish in this Windows workspace: Windows returned `EPERM` while Next.js tried to create folders inside both the ignored `.next` folder and a temporary alternate build folder. The project source was not changed by those failed attempts. The build still needs to be rerun in an environment where Next.js can write its build output.
- `npm audit` could not reach the npm registry because network name resolution was unavailable, so dependency advisories could not be checked in this run.

This is a code and configuration review, not a substitute for students or staff testing the live website. Test each role with approved test accounts before presenting the project as fully accepted.

## 8. Remaining setup steps for the project owner

Complete these in the official Supabase dashboard. Do not send passwords, API keys, SMTP credentials, or recovery codes in chat.

1. **Disable account self-registration.** In Supabase, open **Authentication → Sign In / Providers** and turn off **Allow new users to sign up**. Confirm that an uninvited test user cannot create an account.
2. **Enable leaked-password protection.** Open **Authentication → Security** (or the password security section) and enable the compromised/leaked password check. Save and confirm the advisor clears.
3. **Set up email delivery.** Verify a domain you control with an email provider; publish the provider's DNS records; then configure the sender and SMTP details under **Authentication → SMTP Settings**. Keep the SMTP credentials in the dashboard only. A free `gmail.com` sender address is not a substitute for a verified sending domain.
4. **Check redirect URLs.** In **Authentication → URL Configuration**, allow `https://faculty-eval.vercel.app/auth/callback` and, for local development, `http://localhost:3000/auth/callback`.
5. **Check the reset email template.** The link needs to carry the one-time token to the callback. The Supabase reset template can use:

   ```html
   <a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery">Reset password</a>
   ```

6. **Run a controlled recovery test.** Use a test account you own, request a reset, check delivery, open the link, set a new password, confirm the old password no longer works, then sign in with the new one.
7. **Run role-based acceptance checks.** Use separate approved admin, student, and professor accounts. Confirm the student sees only enrolled courses, unfinished drafts resume, incomplete surveys cannot submit, duplicate submissions are rejected, an admin sees the period's results, and a professor sees comments only for assigned courses.

## 9. Short defense answers

**What connects the front end to the back end?**  
The Next.js app uses Supabase's JavaScript client and the `@supabase/ssr` adapter. The adapter carries the signed-in session through cookies; PostgreSQL Row Level Security checks each request according to that user's role and assignments.

**Why use a database function for submission?**  
It validates eligibility, survey completeness, ratings, and period status together and writes the response as one controlled operation. This prevents a modified browser from skipping client-side rules.

**How are teacher scores calculated?**  
The system averages a submitted course's 1–5 question ratings, then averages only the submitted course averages for that teacher in the selected period.

**How is comment privacy handled?**  
Students choose anonymous or named feedback. Database policies limit which roles can read comments; a professor only sees feedback for courses assigned to them and does not receive a student's identity for anonymous feedback.

**What is still needed before password reset works for all school users?**  
The app already handles the reset request, token verification, and password update. The school needs to configure a verified sender through Supabase SMTP, allow the callback URL, and test delivery to a school account.

## 10. Useful files

- `app/login.tsx` — sign-in, forgot-password request, and new password form.
- `app/auth/callback/route.ts` — recovery-token verification and safe redirect.
- `app/reset-password/page.tsx` — reset page entry point.
- `app/workspace/workspace-gate.tsx` — session, profile-role, and live workspace data loading.
- `app/student-dashboard.tsx` — course selection, grouped survey, draft saving, comments, and submission feedback.
- `lib/supabase/client.ts`, `lib/supabase/server.ts`, and `proxy.ts` — Supabase clients and session refresh.
- `supabase/migrations/` — versioned database schema, functions, and access policies.
- `next.config.ts` — production security headers.
- `package.json` and `package-lock.json` — pinned application dependencies.

