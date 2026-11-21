const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: 2,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
    channel: 'chrome',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    { name: 'mobile-375', use: { viewport: { width: 375, height: 812 } } },
    { name: 'mobile-390', use: { viewport: { width: 390, height: 844 } } }
  ],
  webServer: {
    command: 'node tests/server.js',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false
  }
});