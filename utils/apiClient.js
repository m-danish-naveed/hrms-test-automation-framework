const { chromium } = require('@playwright/test');
const { logger } = require('./logger');

const BASE_URL = process.env.BASE_URL || 'https://opensource-demo.orangehrmlive.com';

/**
 * OrangeHRM's demo instance doesn't expose a documented public REST API.
 * Its own Vue frontend calls internal endpoints under /web/index.php/api/v2/*
 * using a session cookie obtained via the normal login form. This client
 * reproduces that flow so API tests exercise the SAME backend the UI tests
 * exercise, rather than an unrelated third-party API.
 *
 * IMPORTANT — how login works here, and why:
 * The demo's login form now renders entirely client-side via Vue, including
 * the CSRF `_token` field it requires — that token is NOT present in the raw
 * server HTML and is NOT delivered via a matching cookie (confirmed by
 * inspecting both directly). A plain HTTP POST reconstructed by hand can
 * never obtain a valid token as a result. The real request the frontend
 * sends is `POST /web/index.php/auth/validate` with
 * `_token=...&username=...&password=...` as `application/x-www-form-urlencoded`.
 *
 * So `login()` below launches a real (headless-capable) browser ONCE just to
 * get past that client-rendered CSRF step, then switches this.request over
 * to that authenticated browser context's `.request` API. Every method
 * after that — getEmployees/createEmployee/updateEmployee/deleteEmployees —
 * is still a plain HTTP call, not a browser action; only the login step
 * needs a browser. Call `dispose()` when done to close it.
 *
 * NOTE: these are internal, undocumented endpoints. They are realistic to
 * test against (that's the whole point — most real-world API testing is
 * against internal services, not polished public APIs) but can change
 * without notice. If a test here starts failing, check the endpoint shape
 * via browser devtools before assuming your code is wrong.
 */
class ApiClient {
  /** @param {import('@playwright/test').APIRequestContext} request */
  constructor(request) {
    this.request = request;
    this._browser = null;
    this._context = null;
  }

  async login(username, password) {
    logger.info('API: authenticating session (via real browser login — see apiClient.js header comment)');

    this._browser = await chromium.launch({ channel: 'chrome' });
    this._context = await this._browser.newContext({ baseURL: BASE_URL });
    const page = await this._context.newPage();

    // Same resilience pattern as LoginPage.js: explicit generous timeout
    // (this browser/context is created manually here, outside Playwright's
    // fixture system, so it does NOT inherit navigationTimeout from
    // playwright.config.js) plus one retry via reload if the demo is having
    // a slow moment, instead of failing outright on the first timeout.
    try {
      await page.goto('/web/index.php/auth/login', { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.locator('input[name="username"]').waitFor({ state: 'visible', timeout: 20000 });
    } catch (err) {
      logger.warn('API login page did not appear in time — retrying navigation once.');
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.locator('input[name="username"]').waitFor({ state: 'visible', timeout: 20000 });
    }

    await page.locator('input[name="username"]').fill(username);
    await page.locator('input[name="password"]').fill(password);

    const [response] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('/auth/validate'), { timeout: 20000 }),
      page.locator('button[type="submit"]').click(),
    ]);

    await page.close();

    // From here on, this.request is the authenticated browser context's
    // request API — it carries the session cookie the login just
    // established, but every call using it below IS still a plain HTTP
    // request, not a browser action.
    this.request = this._context.request;

    if (response.status() >= 400) {
      logger.fail(`API login failed with status ${response.status()}`);
    } else {
      logger.pass('API session authenticated');
    }

    return response;
  }

  /** Closes the browser/context opened by login(). Call this in test cleanup. */
  async dispose() {
    if (this._context) await this._context.close();
    if (this._browser) await this._browser.close();
    this._context = null;
    this._browser = null;
  }

  async getEmployees(params = {}) {
    return this.request.get('/web/index.php/api/v2/pim/employees', { params });
  }

  async createEmployee({ firstName, lastName }) {
    logger.info(`API: creating employee ${firstName} ${lastName}`);
    return this.request.post('/web/index.php/api/v2/pim/employees', {
      data: { firstName, lastName, middleName: '' },
    });
  }

  async updateEmployee(empNumber, payload) {
    logger.info(`API: updating employee ${empNumber}`);
    // Real endpoint confirmed via network capture: PUT .../employees/{id}
    // (no /personal-details suffix) returns 403 — the actual route the
    // frontend uses is .../employees/{id}/personal-details, and it expects
    // the full personal-details shape, not just the fields being changed.
    // Defaults below match what a freshly-created employee already has;
    // anything passed in `payload` overrides them.
    return this.request.put(`/web/index.php/api/v2/pim/employees/${empNumber}/personal-details`, {
      data: {
        employeeId: '',
        otherId: '',
        drivingLicenseNo: '',
        drivingLicenseExpiredDate: null,
        gender: null,
        birthday: null,
        ...payload,
      },
    });
  }

  async deleteEmployees(empNumbers) {
    logger.info(`API: deleting employees ${JSON.stringify(empNumbers)}`);
    return this.request.delete('/web/index.php/api/v2/pim/employees', {
      data: { ids: empNumbers },
    });
  }
}

module.exports = { ApiClient };