# HRMS Test Automation Framework

A Playwright-based test automation framework for HRMS web applications, covering UI and API testing with a Page Object Model architecture, custom fixtures, data-driven test cases, and a self-built flaky-test tracker.

The framework is built and validated against the public OrangeHRM demo application (`https://opensource-demo.orangehrmlive.com`), which serves as a live reference application for the automation logic.

---

## Tech Stack

| Category          | Technology                                                                       |
| ----------------- | -------------------------------------------------------------------------------- |
| Test Framework    | Playwright (`@playwright/test`)                                                  |
| Language          | JavaScript (Node.js)                                                             |
| Design Pattern    | Page Object Model, Custom Fixtures (`test.extend`)                               |
| API Testing       | Custom API client, session-based authentication                                  |
| Schema Validation | Ajv (JSON Schema)                                                                |
| Test Data         | @faker-js/faker, JSON fixtures                                                   |
| Configuration     | dotenv                                                                           |
| Reporting         | Playwright HTML Reporter, JSON Reporter, Trace Viewer, custom flaky-test tracker |
| Browsers          | Chromium, Firefox                                                                |

---

## Architecture

```
Test Spec ──uses──▶ Page Object ──drives──▶ Application UI
    │
    └──uses──▶ Custom Fixture (authenticatedPage / apiClient / testEmployee)
                        │
                        └──calls──▶ Application's internal API (session-based auth)
```

Test data setup and teardown for UI tests is handled through the API layer wherever possible, keeping UI tests fast and independent of manual seed data.

---

## Folder Structure

```
hrms-test-automation-framework/
├── pages/                     # Page Object Model
│   ├── LoginPage.js
│   ├── DashboardPage.js
│   ├── PIMPage.js
│   └── LeavePage.js
├── tests/
│   ├── ui/
│   │   ├── login/              # Valid, invalid, empty-field, logout, session scenarios
│   │   ├── pim/                 # Add / search / update employee
│   │   └── leave/                # Apply / cancel / search leave
│   └── api/
│       ├── auth.spec.js
│       └── employee.spec.js     # GET / POST / PUT / DELETE + JSON schema validation
├── fixtures/
│   ├── users.json               # Data-driven login cases
│   ├── employees.json
│   └── test-fixtures.js         # authenticatedPage, apiClient, testEmployee
├── utils/
│   ├── logger.js
│   ├── faker.js
│   ├── apiClient.js
│   └── flaky-tracker.js         # Tracks test flakiness across runs
├── scripts/
│   └── generate-flaky-report.js
└── playwright.config.js
```

---

## Key Features

### Page Object Model

All UI interactions are encapsulated in page classes under `pages/`, keeping test specs focused on test logic rather than locators and low-level steps.

### Custom Fixtures

`fixtures/test-fixtures.js` extends Playwright's base test with three fixtures:

- **`authenticatedPage`** — logs in once via the UI and returns an already-authenticated page, removing repeated login steps from every spec.
- **`apiClient`** — a worker-scoped, pre-authenticated API client used both directly in API specs and for fast setup/teardown in UI specs.
- **`testEmployee`** — creates a disposable employee record via the API before a test runs and removes it afterward, regardless of pass or fail. This keeps the suite safe to run against a shared instance, since tests only ever touch records they create themselves.

### API Testing

`utils/apiClient.js` authenticates using the same session-based login flow the application's own frontend uses, then issues direct HTTP calls against its internal API endpoints. This means the API tests exercise the same backend the UI tests exercise, rather than an unrelated or mocked API.

Covered in `tests/api/employee.spec.js`:

- GET / POST / PUT / DELETE operations on employee records
- Authentication success and failure cases
- JSON Schema validation of API responses via Ajv, so a backend response-shape change is caught directly by an API test instead of surfacing as an unrelated UI failure.

### Data-Driven Testing

Login scenarios are defined in `fixtures/users.json` (valid credentials, wrong password, non-existent user, empty fields) and looped over in `login.spec.js`. Adding a new scenario means adding an entry to the JSON file, not writing a new test.

### Flaky Test Tracker

`utils/flaky-tracker.js` parses Playwright's JSON reporter output after each run, records the pass/fail/retry outcome of every test to a persisted history file, and computes a per-test flakiness score:

```
flakinessScore = (runs that needed a retry to pass, or ultimately failed) / total runs observed
```

Run `npm run flaky:report` to regenerate `FLAKY_REPORT.md` — a ranked table of the flakiest tests in the suite, built from accumulated history rather than a single run.

| Test                                              | Runs Observed | Flaky Runs | Failed Runs | Flakiness Score |
| ------------------------------------------------- | ------------- | ---------- | ----------- | --------------- |
| ui/login/login.spec.js > session expiry handling  | 6             | 2          | 0           | 0.33            |
| ui/pim/add-employee.spec.js > adds a new employee | 6             | 0          | 0           | 0.00            |

_(Populates with real data after running the suite locally — see Running Locally below.)_

---

## Test Coverage

**UI**

- Login: valid/invalid credentials, empty fields, logout, session expiry
- PIM: add employee, search employee, update employee
- Leave: apply for leave, cancel leave, search leave records

**API**

- Authentication (success/failure)
- Employee CRUD operations
- Response schema validation

---

## Known Limitations

- **Leave tests require an account with an available leave balance.** `apply-leave.spec.js` and `cancel-leave.spec.js` skip (rather than fail) with a clear message if the configured account has no leave types with a balance, since the leave-type dropdown genuinely does not render in that state. To exercise these tests, assign a leave entitlement to the account under **Leave > Entitlements > Add Entitlement** and re-run.
- **API endpoints are internal and undocumented.** They were reverse-engineered from the application's own network traffic, not from a published contract, and may change without notice. If an API test fails unexpectedly, verify the current request/response shape via browser devtools before assuming the test code is wrong.

---

## Playwright Concepts Demonstrated

Page Object Model · custom fixtures (`test.extend`) · worker-scoped vs test-scoped fixtures · API-based setup/teardown · UI and API assertions (`expect`) · parallel execution (`fullyParallel`) · multiple browser projects (Chromium, Firefox) · isolated browser contexts per test · retry logic · trace viewer (`retain-on-failure`) · screenshots and video on failure · environment configuration via `.env` · test tagging (`@smoke` / `@regression`) · data-driven testing via JSON fixtures.

---

## Running Locally

```bash
git clone https://github.com/m-danish-naveed/hrms-test-automation-framework.git
cd hrms-test-automation-framework
npm install
npx playwright install --with-deps
cp .env.example .env

npm test                  # Full suite, all browsers
npm run test:smoke        # @smoke tagged tests only
npm run test:ui           # UI specs only
npm run test:api          # API specs only
npm run report             # Open the last HTML report
npm run flaky:report       # Regenerate FLAKY_REPORT.md from the last run
```

The suite runs against a shared public demo instance by default, so worker concurrency is deliberately kept low (see `playwright.config.js`) to avoid throttling. Point `BASE_URL` in `.env` at a dedicated or local instance to safely increase parallelism.

---

## What's Next

- Visual regression testing on dashboard widgets using Playwright's built-in screenshot diffing
- Extending coverage to Recruitment and My Info modules using the same API-seeded/API-torn-down pattern used for PIM and Leave
- CI/CD integration for automated test execution on push and scheduled runs
