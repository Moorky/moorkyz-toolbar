'use strict';

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: '.\\test\\browser',
  fullyParallel: false,
  workers: 1,
  globalTeardown: require.resolve('.\\test\\browser-teardown.js'),
  timeout: 90000,
  expect: { timeout: 15000 },
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:8876',
    channel: 'msedge',
    headless: true,
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node test\\browser-fixture.js',
    url: 'http://127.0.0.1:8876/api/config',
    reuseExistingServer: false,
    timeout: 30000,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 10000 },
  },
});
