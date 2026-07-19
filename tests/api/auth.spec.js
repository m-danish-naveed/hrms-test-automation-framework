const { test, expect } = require('@playwright/test');
const { ApiClient } = require('../../utils/apiClient');
const { logger } = require('../../utils/logger');

test.describe('API — Authentication', () => {
  test('@smoke valid credentials establish an authenticated session', async ({ request }) => {
    const client = new ApiClient(request);
    try {
      const response = await client.login('Admin', 'admin123');

      expect(response.status()).toBeLessThan(400);
      logger.pass('API login succeeded with valid credentials');

      // A subsequent authenticated call should now succeed using the same
      // session cookie, proving the login actually established a session
      // rather than just returning 200 on the login page itself.
      const employees = await client.getEmployees();
      expect(employees.status()).toBe(200);
    } finally {
      await client.dispose();
    }
  });

  test('@regression invalid credentials do not grant access to protected endpoints', async ({ request }) => {
    const client = new ApiClient(request);
    try {
      await client.login('Admin', 'definitely-wrong-password');

      const employees = await client.getEmployees();
      expect(employees.status()).toBeGreaterThanOrEqual(400);
      logger.fail('API correctly denied access after failed authentication');
    } finally {
      await client.dispose();
    }
  });
});