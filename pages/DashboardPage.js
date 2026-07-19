const { logger } = require('../utils/logger');

class DashboardPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;
    this.userDropdown = page.locator('.oxd-userdropdown-tab');
    this.logoutLink = page.getByText('Logout');
    this.dashboardHeader = page.locator('.oxd-topbar-header-breadcrumb-module');
    this.widgets = page.locator('.oxd-grid-item');
    this.sidebarMenu = page.locator('.oxd-sidepanel');
  }

  async isLoaded() {
    await this.dashboardHeader.waitFor({ state: 'visible' });
    return this.dashboardHeader.textContent();
  }

  async logout() {
    logger.info('Logging out');
    await this.userDropdown.click();
    await this.logoutLink.click();
  }

  async getWidgetCount() {
    return this.widgets.count();
  }

  async navigateTo(moduleName) {
    logger.info(`Navigating to ${moduleName} module`);
    await this.page.locator('.oxd-main-menu-item', { hasText: moduleName }).click();
  }
}

module.exports = { DashboardPage };
