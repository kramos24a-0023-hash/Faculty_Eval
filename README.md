# Faculty Evaluation

Responsive front-end prototype for the OLOPSC faculty evaluation workspace.

## Run

Open `index.html` in a modern browser. For a local HTTP preview, run `node serve.mjs` from this directory and visit `http://127.0.0.1:4173`. There is no build step or package installation. The server binds only to loopback and serves files from this project directory.

## Project structure

```text
index.html                 Semantic page structure and asset references
styles/
  tokens.css                Color, typography, and shared design tokens
  base.css                  Reusable text, button, link, and avatar styles
  layout.css                App shell, sidebar, header, and page grid
  components.css            Cards, tables, modal, progress, and toast
  responsive.css            Tablet, mobile, and reduced-motion rules
scripts/
  app.js                    Application bootstrap and dashboard bindings
  modules/
    notifications.js        Toast feedback
    modal.js                Evaluation period dialog
    navigation.js           Workspace selection and mobile sidebar
    search.js               Search input and keyboard shortcut
serve.mjs                  Loopback-only local preview server
```

## Coding conventions

- Use two spaces for indentation, descriptive names, and one statement per line.
- Keep page structure in semantic HTML; use labels and accessible names for controls.
- Define palette and shared values in `styles/tokens.css`; place responsive rules in `styles/responsive.css`.
- Keep styles grouped by purpose and avoid inline styling.
- Keep browser behavior in focused scripts under `scripts/modules/`. Modules register under `window.FacultyEvaluation` and load in order from `index.html`. This classic-script pattern preserves the direct `file://` preview without requiring a bundler.
- Use native browser APIs and avoid dependencies until the project needs them.

## Prototype scope

- Dashboard includes evaluation participation, evaluation periods, recent activity, and program progress.
- Sidebar navigation previews workspace selection for programs, courses, sections, teachers, assignments, students, criteria, periods, results, reports, and user management.
- The evaluation period form and toast interactions are demonstration UI only; records are not persisted.
- Sample dashboard data is illustrative. No authentication or database is connected.

## Reference workflow

1. Configure programs and program chairs; create courses and sections.
2. Add teachers and assign them to courses; register eligible students.
3. Maintain evaluation criteria and open a semester evaluation period.
4. Check student eligibility by status and section, then accept an evaluation for an eligible teacher, course, and term.
5. Validate submissions, save the evaluation with criterion responses, and aggregate results when the period closes.
6. Program chairs and evaluators review authorized results and reports.

The supplied diagrams show slightly different schema versions. Confirm whether evaluator accounts are separate user records and whether student section membership is direct before building a production database.
