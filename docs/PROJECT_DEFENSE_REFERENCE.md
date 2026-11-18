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

### Why these languages, database, and scripts were chosen

- **TypeScript** adds compile-time checks to JavaScript, which helps catch wrong field names, role values, and data shapes while the app is being changed. It is used for both UI and server route code.
- **React** fits the interactive parts of the system: survey rating buttons, grouped forms, expandable admin lists, filters, progress indicators, and live feedback messages.
- **Next.js** supplies the page and route structure, the password-recovery callback endpoint, and the production build. Its App Router keeps the public sign-in, student, admin, and professor destinations in one application.
- **SQL and PostgreSQL** suit the school's connected records: a student belongs to a program/year, a course belongs to a program, and submissions connect students, courses, periods, and question ratings. Foreign keys, unique constraints, check constraints, transactions, and RLS keep these relationships and rules at the data layer.
- **Supabase** was chosen as the hosted PostgreSQL and Auth service. The app uses Supabase's supported client and SSR session adapter instead of creating a separate custom authentication server.
- **SQL migration files** version database changes alongside the source code. They make the schema and security-policy history reviewable and repeatable across environments.
- **npm scripts:** `npm run dev` starts local development; `npm run typecheck` checks TypeScript without emitting files; `npm run build -- --webpack` makes a production build; `npm start` serves that built app. There is currently no automated test or lint script in `package.json`, so manual role-based acceptance tests are still needed.
- **GitHub and Vercel** provide source history and hosting. A push to the production branch starts a Vercel build and deployment.

## 4. Main user journeys

### Student evaluation

1. The student signs in at `/` with an account created by the school administrator.
2. The workspace checks the authenticated user and loads the profile role. A student sees their program, year, current evaluation period, enrolled courses, and assigned professors from live database records.
3. The student searches or selects a course and completes its grouped questions. Each item is rated from 1 to 5. The survey can be saved as a draft and resumed later.
4. The student can add an optional comment and choose whether to share their name with the professor.
5. On submission, the database function checks authorization, enrollment, period status, question set, and rating values before writing the result. The app displays success or a message explaining that required items remain.

### Administrator review

The administrator workspace uses the same school programs, student records, courses, faculty assignments, evaluation periods, questions, and submissions as the student workflow. Administrators can review participation, statistics, and comments. Displayed teacher averages are calculated from submitted course evaluations for the selected period; if a teacher has two course evaluations, the teacher-level average is the mean of the submitted course-level averages.

The faculty directory is grouped by department/program, professor, course, and year level. It displays each course's response rate. It now also displays an independent subject grade beside that assignment when at least one submitted survey has ratings for that course. The subject grade is calculated from that subject's submitted ratings and is separate from the professor's combined average. Courses without a scored survey do not display a grade. The admin can search the directory and open professor results for per-question results and comments; hiding a professor's details only hides them in the current interface and is not a database access control.

Administrators can create evaluation periods and see their active/upcoming/closed status, manage course-specific questionnaires, browse the live student and faculty directories, and review program participation. Account provisioning itself is done in the Supabase dashboard, not through a public sign-up form.

### Professor comments

The professor view reads comments restricted by database policy to that professor's assigned courses. Student identity and ratings are not included in that professor view. A name appears only when the student elected to share it.

### Password recovery

1. The user selects **Forgot password?** and enters an email address.
2. The app calls Supabase Auth `resetPasswordForEmail` and directs the recovery link to `/auth/callback`.
3. The callback verifies the one-time recovery token or exchanges the PKCE code, then redirects without caching to `/reset-password`.
4. The user enters and confirms a new password. The app updates it through Supabase Auth and signs the recovery session out.

The app uses a neutral reset-request confirmation so the screen does not reveal whether an email address belongs to an account. However, production email delivery is currently not ready: the live project's custom SMTP is disabled, and the previous sender used an unverified `gmail.com` domain. The code path exists, but a real message to a school account cannot be confirmed until the school configures an email sender they control.

## 5. System functionality and quality requirements

### Full function inventory

| User / area | Function | What it does |
|---|---|---|
| Everyone | Sign in | Authenticates an existing account with email and password. |
| Everyone | Forgot password / reset password | Requests a recovery email, verifies the callback, then updates the password. Delivery still needs SMTP configuration. |
| Everyone | Change password | Authenticated user can open the change-password form and set a new password. |
| Everyone | Sign out | Clears the Supabase session and returns to the sign-in page. |
| Everyone | Role-based workspace gate | Checks the signed-in Supabase user against the role in `profiles`; student, admin, and professor routes show their own view. |
| Student | View profile and schedule | Shows the student record, program/year, current period, assigned subjects, and the instructors listed for each subject. |
| Student | Find subjects and professors | Searches the student's period-specific course/professor assignments and opens a subject survey. |
| Student | Answer grouped survey | Displays the active course-specific questionnaire, or shared questionnaire when the course has no custom survey; rating options are 1–5. |
| Student | Save and resume | Saves draft ratings, comment, and anonymity choice; the draft is restored when the student returns. Progress and save errors are announced in the interface. |
| Student | Validate and submit | Highlights unanswered items and blocks incomplete surveys. A valid submission is sent to the database function; successful submission removes the draft and marks the course complete. A unique database key prevents a duplicate final submission. |
| Student | Add comment and choose anonymity | Saves an optional comment up to 600 characters and lets the student decide whether their name is visible to the assigned professor. |
| Administrator | Overview and participation | Shows live enrollment and submission totals, participation percentage, program participation, and evaluation-period activity for the selected period. |
| Administrator | Create evaluation period | Adds a school-year/semester period with dates. New periods begin closed; opening or closing periods is not currently exposed as an admin control in the interface. |
| Administrator | Manage subject questionnaires | Selects a period and subject, copies the standard survey to a course, adds/edits/removes questions and groups, saves the custom survey, or returns to the standard survey. Survey editing locks once responses exist. |
| Administrator | Browse faculty directory | Groups by program → instructor → course → year, shows response rate, and now shows a separate subject grade when that course has scored survey results. |
| Administrator | Browse student roster | Groups students by department/program/year and shows the subjects assigned for the selected evaluation period. Search filters the roster. |
| Administrator | Review professor results | Ranks faculty, shows course-level and per-question statistics, ratings/points, response counts, and comments. The **Hide details** control only hides the panel in the current view. |
| Professor | Read assigned-course comments | Shows comments for courses attached to the professor's authenticated profile assignment. A name is shown only if the student chose named feedback; ratings and student account identity are not presented in this view. |
| Developer / local preview | Admin/student preview routes | `/admin-preview` and `/student-preview` are development-only previews; production routing returns not found for these routes. They are not live user workspaces. |

**Not provided in the website:** public account creation, in-app account provisioning, editing student/course records, downloading/exporting reports, and an admin control to open/close an evaluation period. Accounts and school master data are maintained through Supabase/admin processes. The live Supabase self-registration setting still needs direct dashboard verification.

### Non-functional requirements and current status

| Quality area | Design / current status |
|---|---|
| Security | Role checks are repeated in database RLS. Submission checks run in PostgreSQL. Recovery redirects use `no-store` and `no-referrer`; production responses add browser security headers. Leaked-password protection is currently off, and RLS is disabled on the two private allowlist tables, so security setup is not fully complete. |
| Privacy | Professor feedback is limited to assigned courses by RLS. The student can leave comments anonymous. Admin result access is broader by design. |
| Data integrity | Foreign keys, primary/unique keys, rating and comment checks, period date checks, a unique final submission per student/course/period, and a trigger to lock questionnaires after responses protect saved data. |
| Usability | Student survey questions are grouped, have clear 1–5 choices, show progress, preserve drafts, and explain missing answers or save/submission status. Admin lists use program/year grouping and search. |
| Accessibility | Form labels, button names, alert/status roles, and progress semantics are present in key flows. This is not a formal WCAG audit; keyboard-only and screen-reader testing remains to be done. |
| Device support | Responsive CSS includes mobile layouts for student and admin screens. Test on actual phones and small screens before claiming full device coverage. |
| Performance | Admin result loading pages database reads in batches of 500. The current Supabase Performance Advisor lists 8 unindexed foreign keys and 9 overlapping permissive policies; review these before larger data volumes. |
| Maintainability | TypeScript, pinned package versions, versioned SQL migrations, and the documented `typecheck`/`build` scripts support repeatable changes. No automated unit or end-to-end test script is configured yet. |
| Availability | The Vercel production deployment was reported READY for the current main commit during this review. No uptime target or recovery-time guarantee has been established here. |
| Authentication email delivery | App recovery logic exists, but SMTP is disabled. Password recovery to ordinary school addresses is not ready until SMTP sender verification and live email testing. |

## 6. Data model and survey scoring

The live Supabase database uses relational tables with UUID keys, foreign keys, and unique constraints. These are the public tables currently present:

| Table | What it stores and how it connects |
|---|---|
| `programs` | Academic program and department labels. A program can have student records and courses. |
| `profiles` | App profile keyed to the Supabase Auth user ID; stores the person's name and role (`admin`, `student`, or `professor`). |
| `student_records` | School student ID, enrollment date, program, and year level; one row per student profile. |
| `courses` | Subject code and name; each course belongs to a program and its code is unique within that program. |
| `course_professors` | Link between a course and an authenticated professor profile. Used for profile-based professor access to assigned-course feedback. |
| `instructors` | Directory names for teaching staff, independent of whether they have a sign-in profile. |
| `course_instructors` | Link between courses and directory instructors; used to populate the teaching roster and evaluation reporting. |
| `evaluation_periods` | Name, school year, semester, start/end timestamps, and open/closed switch for a cycle. |
| `student_enrollments` | Link between a student, course, and evaluation period; a composite primary key prevents duplicate enrollment rows for that combination. |
| `evaluation_criteria` | Question text, section, survey group, order, active state, period, and optional course. A null course means shared standard question; a course ID means a subject-specific question. |
| `evaluation_drafts` | A student's saved ratings, comment, anonymity choice, and last-updated time for a course and period. |
| `evaluation_submissions` | Final submission identity and timestamp. A unique student/course/period constraint prevents a second final submission for the same assignment. |
| `evaluation_ratings` | One 1–5 rating per submission and criterion, linked by a composite key. |
| `evaluation_comments` | One comment per submission, with course/period, timestamp, anonymous flag, and optional name shown to the professor. Student ID is reached through the related submission, not copied into the comment row. |

Supabase Auth also maintains its own `auth.users` records. The `profiles.id` foreign key connects an app profile to the Auth user. Two additional allowlist tables live in the `private` schema: `admin_email_allowlist` and `student_email_allowlist`. They hold addresses used by account-provisioning checks and are not ordinary dashboard tables.

### How the relationships work

```text
auth.users ── profiles ── student_records ── programs
                    │                           │
                    ├── course_professors       └── courses ── course_instructors ── instructors
                    │                                  │
                    └── student_enrollments ───────────┤
                                  │                     ├── evaluation_criteria
                                  └── evaluation_periods└── evaluation_submissions
                                                             ├── evaluation_ratings ── evaluation_criteria
                                                             ├── evaluation_comments
                                                             └── evaluation_drafts (student/course/period key)
```

**Important faculty-link distinction:** `instructors` and `course_instructors` are the directory roster. `profiles` and `course_professors` are sign-in identities and their authorization assignments. In the live snapshot, the directory has 6 instructor records and 7 course links, while `course_professors` has 0 rows. That means the admin and student roster can show named instructors, but professor comment access requires the account-linked `course_professors` rows to be assigned as well.

The live snapshot on November 18, 2026 showed 3 programs, 3 profiles, 1 student record, 7 courses, 1 evaluation period, 7 enrollments, 44 criteria, 1 submission, 44 ratings, 1 comment, and no saved drafts. Counts change as the school adds records and responses.

The survey criteria can be grouped into sections and assigned to individual courses, allowing different subjects taught by the same professor to have their own survey. Ratings are integers from 1 to 5. A course result is the arithmetic mean of its submitted item ratings. The professor's overall average for a period is the mean of the course-level results that have actually been submitted. Unsubmitted courses do not contribute a score. For example, if two course averages are 3.5 and 4.9, the combined average is `(3.5 + 4.9) / 2 = 4.2`.

The faculty directory's per-subject grade uses that same course-level result and appears only when at least one completed survey has rating data for that course. For example, the course row may show `4.20 / 5` while the professor's combined average includes that result along with other subjects that have submitted surveys. These averages are calculated in the admin dashboard from submission/rating rows; the database does not store a separate grade column. The live database currently has one course with a submitted result: SDF104, averaging `3.73 / 5` from 44 item ratings. The other six current courses have no result, so their directory rows do not show a grade yet.

### Database functions and triggers

| Database routine | Purpose |
|---|---|
| `private.user_is_school_account()` | Confirms that the current Auth account is an OLOPSC school account, an administrator, or a specifically allowlisted provisioned student. Used inside access checks. |
| `private.user_has_role(required_role)` | Checks that the signed-in user has the requested role and passes the account eligibility check. |
| `private.professor_teaches_course(course_id)` | Confirms the signed-in professor has a profile-linked assignment for a course. |
| `public.reject_non_school_account()` trigger function | Blocks Auth user creation for addresses outside the permitted school/allowlist rules. It is called by an Auth trigger, not intended as a client RPC. |
| `public.create_profile_for_new_user()` trigger function | Creates the matching app profile when an Auth user is provisioned and assigns the initial role according to the allowlist rules. It is trigger-only. |
| `public.submit_course_evaluation(...)` | Validates the student, enrollment, open period, exact required active survey, 1–5 ratings, and comment length; inserts the submission, ratings, and optional comment atomically. Execute is granted to authenticated users and revoked from public/anonymous roles. |
| `public.prevent_changing_surveys_after_responses()` trigger function | Rejects adding, changing, or removing questions for a survey after responses exist, protecting the meaning of saved results. |
| `public.rls_auto_enable()` | PostgreSQL event-trigger helper already present in the database; execute is limited to the database owner role by the migration. It is not an app feature or API endpoint. |

The Auth trigger functions create/check user accounts at provisioning time. The survey-lock trigger runs on evaluation criteria edits. The submission function is the core transactional write path. Other dashboard reads and questionnaire/draft edits use Supabase table operations subject to RLS.

## 7. Security and privacy design

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

The Supabase project was active and the live migration history included the current schema migrations. The Security Advisor reported two warnings, and the Supabase table inventory separately returned a critical warning for disabled RLS on the two `private` allowlist tables:

1. **Leaked-password protection is disabled.** Turn it on in Supabase Authentication security settings.
2. **Authenticated execution of `submit_course_evaluation` is flagged.** The function is intentionally callable by signed-in users and enforces student eligibility and all submission constraints internally. Keep its public/anonymous execution revoked; review function changes and policies carefully when maintaining it.
3. **RLS is disabled on `private.admin_email_allowlist` and `private.student_email_allowlist`.** A read-only privilege check found no direct `SELECT`, `INSERT`, `UPDATE`, or `DELETE` table grants to either `anon` or `authenticated`; the `anon` role also lacks `USAGE` on the `private` schema. Still, the database advisor recommends defense-in-depth RLS. Do not apply the following statements without first deciding how the account-provisioning functions should read these allowlists and what policies are appropriate:

   ```sql
   ALTER TABLE private.admin_email_allowlist ENABLE ROW LEVEL SECURITY;
   ALTER TABLE private.student_email_allowlist ENABLE ROW LEVEL SECURITY;
   ```

   Enabling RLS without suitable policies can make direct access unavailable and could affect helper-function behavior depending on ownership and execution context. These statements were not run during this documentation task.

The Performance Advisor also listed 8 unindexed foreign keys, 2 unused indexes, and 9 overlapping permissive policies. These are performance/maintainability findings rather than proof of an authorization bypass. Review query plans and consolidate equivalent policies carefully; permissive policies combine with OR behavior.

## 8. What was checked for this reference

- Local repository was on `main` and had no unrelated user changes before the current changes.
- GitHub repository and connected account matched `kramos24a-0023-hash/Faculty_Eval`.
- The subject-grade directory and expanded system documentation were pushed to GitHub `main` at commit `7f4707c0d25a895457189e785e37eecf2fbc19ca`; Vercel reported its production deployment as READY.
- A read-only per-course aggregate verified the new display case: SDF104 has one submission and 44 ratings with a `3.73 / 5` average; the other six current courses have zero submissions.
- Supabase project `Faculty_Eval` was active; its migration list matched the repository.
- Local code inspection confirmed login, recovery, callback, student, administrator, and professor routes, plus the absence of a sign-up control or `signUp` call.
- The live database table inventory and migration history were checked through the Supabase connection. All 14 public tables have RLS enabled; the 2 private allowlist tables do not, but direct client roles currently lack table CRUD grants.
- The student, administrator, and professor views are separate role-gated routes. Test the full workflows with dedicated accounts; this review is not a substitute for user acceptance testing.
- `npm run typecheck` passed after the current code changes.
- `npm run build -- --webpack` could not finish in this Windows workspace: Windows returned `EPERM` while Next.js tried to create folders inside both the ignored `.next` folder and a temporary alternate build folder. The project source was not changed by those failed attempts. The build still needs to be rerun in an environment where Next.js can write its build output.
- `npm audit` could not reach the npm registry because network name resolution was unavailable, so dependency advisories could not be checked in this run.

This is a code and configuration review, not a substitute for students or staff testing the live website. Test each role with approved test accounts before presenting the project as fully accepted.

## 9. Remaining setup steps for the project owner

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

## 10. Short defense answers

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

## 11. Useful files

- `app/login.tsx` — sign-in, forgot-password request, and new password form.
- `app/auth/callback/route.ts` — recovery-token verification and safe redirect.
- `app/reset-password/page.tsx` — reset page entry point.
- `app/workspace/workspace-gate.tsx` — session, profile-role, and live workspace data loading.
- `app/student-dashboard.tsx` — course selection, grouped survey, draft saving, comments, and submission feedback.
- `lib/supabase/client.ts`, `lib/supabase/server.ts`, and `proxy.ts` — Supabase clients and session refresh.
- `supabase/migrations/` — versioned database schema, functions, and access policies.
- `next.config.ts` — production security headers.
- `package.json` and `package-lock.json` — pinned application dependencies.

