# OrangeHRM Playwright Framework

A Playwright automation framework built against the public [OrangeHRM demo](https://opensource-demo.orangehrmlive.com) — covering UI and API testing, Page Object Model, custom fixtures, data-driven tests, and a self-built flaky-test tracker.

Scoped deliberately narrow (3 modules, not 7) to go deep instead of wide. See [Design Decisions](#design-decisions) for why.

## Tech Stack

Playwright (JavaScript) · Node.js · Page Object Model · REST API testing · JSON Schema validation (Ajv) · GitHub Actions · HTML Reports · Trace Viewer · Video Recording · Custom Fixtures · Data-Driven Testing

## Architecture

```
Test Spec ──uses──▶ Page Object ──drives──▶ OrangeHRM UI
    │
    └──uses──▶ Custom Fixture (auth / apiClient / testEmployee)
                        │
                        └──calls──▶ OrangeHRM internal API (session auth)

CI: push → smoke suite → HTML report + flaky report → artifacts uploaded
    nightly → full regression suite → same reporting pipeline
```

## Folder Structure

```
orangehrm-playwright-framework/
├── pages/                    # Page Object Model
│   ├── LoginPage.js
│   ├── DashboardPage.js
│   ├── PIMPage.js
│   └── LeavePage.js
├── tests/
│   ├── ui/
│   │   ├── login/            # valid/invalid/empty/logout/session expiry
│   │   ├── pim/               # add/search/update employee
│   │   └── leave/             # apply/cancel/search
│   └── api/
│       ├── auth.spec.js
│       └── employee.spec.js  # GET/POST/PUT/DELETE + JSON schema validation
├── fixtures/
│   ├── users.json            # data-driven login cases
│   ├── employees.json
│   └── test-fixtures.js      # authenticatedPage, apiClient, testEmployee
├── utils/
│   ├── logger.js
│   ├── faker.js
│   ├── apiClient.js
│   └── flaky-tracker.js      # the differentiator — see below
├── scripts/
│   └── generate-flaky-report.js
├── .github/workflows/
│   └── playwright.yml
└── playwright.config.js
```

## Why This Project (and Why It's Scoped Narrow)

Most Playwright + OrangeHRM portfolio projects look the same: POM, a handful of modules, GitHub Actions, done. That's a fine baseline, but it doesn't say much on its own anymore — the pattern is easy to scaffold. This project tries to say something specific instead: **flaky test tracking**, built from scratch on top of Playwright's own JSON reporter output, because "my tests are flaky sometimes" is a real problem every QA team deals with and almost no portfolio project touches it.

Three modules (Login, PIM, Leave) are automated properly — with real setup/teardown via API, real data-driven cases, real schema-validated API tests — rather than seven modules automated thinly.

## The Flaky Test Tracker

`utils/flaky-tracker.js` parses Playwright's JSON reporter output (`reports/test-results.json`) after every run, records per-test outcomes (pass/fail/retry count) to a persisted history file, and computes a flakiness score per test:

```
flakinessScore = (runs that needed a retry to pass, or ultimately failed) / total runs observed
```

`npm run flaky:report` (also run automatically in CI, `if: always()`) renders this into `FLAKY_REPORT.md` — a ranked table of the flakiest tests in the suite, regenerated and appended to on every run so flakiness is tracked **over time**, not just in the last run.

Sample output after a few runs:

| Test                                                     | Runs Observed | Flaky Runs | Failed Runs | Flakiness Score |
| -------------------------------------------------------- | ------------- | ---------- | ----------- | --------------- |
| ui/login/login.spec.js > @regression session expires...  | 6             | 2          | 0           | 0.33            |
| ui/pim/add-employee.spec.js > @smoke adds a new employee | 6             | 0          | 0           | 0.00            |

_(This table will populate with real data on your first few local/CI runs — see [Running Locally](#running-locally).)_

## Custom Fixtures

`fixtures/test-fixtures.js` defines three fixtures beyond Playwright's defaults:

- **`authenticatedPage`** — logs in once via the UI, hands back an already-authenticated page, so specs don't repeat login boilerplate.
- **`apiClient`** — a pre-authenticated API context (session cookie + CSRF token handled internally) used both directly in API specs and for fast setup/teardown in UI specs.
- **`testEmployee`** — creates a throwaway employee via the API before a test runs and deletes it afterward, in a `try`/`use`/cleanup pattern, regardless of pass or fail. This is what makes it safe to run this suite against a **shared public demo instance**: tests never touch seeded or default data, only records they created themselves.

## API Testing

OrangeHRM's demo doesn't expose a documented public REST API, so `utils/apiClient.js` reproduces the same session-based auth flow OrangeHRM's own frontend uses (login form → CSRF token → session cookie) and calls its internal `/api/v2/pim/employees` endpoints. This was a deliberate choice over using an unrelated practice API (like reqres.in): it means the API tests exercise the **same backend** the UI tests exercise, which is a more realistic and more defensible testing story.

Covered: GET, POST, PUT, DELETE, auth success/failure, and JSON Schema validation on the employee list response via Ajv (`tests/api/employee.spec.js`) — so a backend shape change fails an API test loudly instead of a UI test failing mysteriously three modules away.

> **Note:** these are internal, undocumented endpoints inferred from the app's own network traffic — not a stable published contract. If a test here fails after an OrangeHRM demo update, check the actual request/response shape via browser devtools before assuming the test code is wrong.

## Data-Driven Testing

Login cases live in `fixtures/users.json` (valid, wrong password, non-existent user, empty fields) and are looped over in `login.spec.js` — adding a new case means adding a line to the JSON, not writing a new test.

## Regression Candidate: Approved Leave Cancellation

`tests/ui/leave/cancel-leave.spec.js` includes a test (`@regression approved leave requires explicit confirmation before cancellation`) written against a specific concern: can an employee cancel a leave request an admin has **already approved**, without a distinct warning? An approved leave affects attendance/payroll state elsewhere in the app, so silently allowing this would be a real data-integrity gap, not just a missing nicety.

This test asserts the _safe_ behavior and is marked as a documented candidate — **run it against a live instance with an approved leave present before relying on it.** If it fails, that's the actual finding: document it here with a trace/screenshot rather than loosening the assertion to force a pass.

## Known Limitation: Leave Tests Require an Account With Leave Balance

`tests/ui/leave/apply-leave.spec.js` and `tests/ui/leave/cancel-leave.spec.js`'s smoke tests both skip (not fail) with a clear message if the account in `.env` has no leave types with an available balance. This was confirmed via a live check against the shared demo's `Admin` account: the Apply Leave page shows **"No Leave Types with Leave Balance"** instead of the leave-type dropdown, and there's genuinely nothing to interact with — this is a data/environment state on the shared account, not a flaky selector or timing issue (a lot of earlier debugging time went into this before the actual cause was confirmed with a screenshot).

To actually exercise these tests: log in as the account configured in `.env`, go to **Leave > Entitlements > Add Entitlement**, assign a balance for the current year, then re-run. Since this is a shared public demo, that balance may get consumed or reset by other people testing against the same instance over time — if these tests start skipping again later, that's most likely why.

## Playwright Concepts Demonstrated

Page Object Model · custom fixtures (`test.extend`) · `beforeEach`/`afterEach` hooks for API-based setup/teardown · assertions (`expect`, both UI and API) · parallel execution (`fullyParallel`) · multiple browser projects (Chromium, Firefox) · browser isolation (fresh context per test) · retry logic (2x in CI) · trace viewer (`retain-on-failure`) · screenshots and video on failure · environment configuration via `.env` · test tags (`@smoke` / `@regression`) · data-driven testing via JSON fixtures.

## Running Locally

```bash
git clone <your-repo-url>
cd orangehrm-playwright-framework
npm install
npx playwright install --with-deps
cp .env.example .env

npm test                  # full suite, all browsers
npm run test:smoke        # @smoke only
npm run test:ui           # UI specs only
npm run test:api          # API specs only
npm run report             # open the last HTML report
npm run flaky:report       # regenerate FLAKY_REPORT.md from the last run
```

Workers are capped (not maxed) deliberately — this suite runs against the **public, shared** OrangeHRM demo. Full parallelism against it causes throttling that has nothing to do with your code. See `playwright.config.js`.

## CI/CD

`.github/workflows/playwright.yml`:

- **On push/PR** → runs the `@smoke` subset only (fast feedback, low load on the shared demo).
- **Nightly (cron)** → runs the full regression suite.
- Both jobs regenerate `FLAKY_REPORT.md` and upload it, the HTML report, and (on failure) traces as workflow artifacts — all with `if: always()` so a failed run still leaves you something to look at.

## What I'd Add Next

- Visual regression testing on the Dashboard widgets (Playwright's built-in screenshot diffing).
- Recruitment and My Info modules, following the same API-seeded/API-torn-down pattern used in PIM and Leave.
- Confirm and document the approved-leave-cancellation regression candidate above with an actual trace from a live run.

## How I Used AI

I used Claude to scaffold the initial file/folder structure, boilerplate for page objects, and the flaky-tracker script's structure. I designed the fixture architecture (particularly the API-seeded/API-torn-down pattern for shared-instance safety), decided the module scope and CI strategy, and reviewed/adjusted the generated code against the actual OrangeHRM demo's DOM. Selectors and endpoint assumptions should be re-verified against a live run before treating this as fully proven — see the note in the API Testing section above.
