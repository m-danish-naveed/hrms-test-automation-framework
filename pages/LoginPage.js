const { logger } = require('../utils/logger');

class LoginPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;
    this.usernameInput = page.locator('input[name="username"]');
    this.passwordInput = page.locator('input[name="password"]');
    this.loginButton = page.locator('button[type="submit"]');
    this.errorAlert = page.locator('.oxd-alert-content-text');
    this.requiredFieldErrors = page.locator('.oxd-input-field-error-message');
    this.forgotPasswordLink = page.locator('.orangehrm-login-forgot-header');
  }

  async goto() {
    logger.info('Navigating to login page');

    // Deliberately NOT using the default waitUntil: 'load'. This demo pulls
    // in third-party scripts (analytics, etc.) that can hang indefinitely
    // without ever firing 'load', which makes Playwright wait until
    // navigationTimeout expires — this is what "Chrome just keeps loading
    // and never shows the site" looks like from the outside.
    //
    // 'domcontentloaded' fires as soon as the HTML is parsed, which is all
    // we actually need — then we wait for the real thing the test cares
    // about (the login form being interactive) instead of a network signal.
    try {
      await this.page.goto('/web/index.php/auth/login', { waitUntil: 'domcontentloaded' });
      await this.usernameInput.waitFor({ state: 'visible', timeout: 15000 });
    } catch (err) {
      logger.warn('Login form did not appear in time — retrying navigation once');
      await this.page.reload({ waitUntil: 'domcontentloaded' });
      await this.usernameInput.waitFor({ state: 'visible', timeout: 15000 });
    }
  }

  async login(username, password) {
    logger.info('Login started');

    if (username) {
      await this.usernameInput.fill(username);
      logger.info('Username entered');
    }
    if (password) {
      await this.passwordInput.fill(password);
      logger.info('Password entered');
    }

    await this.loginButton.click();
  }

  async getErrorMessage() {
    return this.errorAlert.textContent();
  }

  async getRequiredFieldErrorCount() {
    return this.requiredFieldErrors.count();
  }
}

module.exports = { LoginPage };