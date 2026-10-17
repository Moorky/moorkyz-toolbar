import { defineConfig } from "@playwright/test";

function configuredPort(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (!/^\d{1,5}$/.test(value)) {
    throw new Error(`${name} must be a valid TCP port.`);
  }
  const port = Number(value);
  if (port < 1 || port > 65_535) {
    throw new Error(`${name} must be a valid TCP port.`);
  }
  return port;
}

const fixturePort = configuredPort("MOORKYZ_TOOLBAR_FIXTURE_PORT", "4173");
const portalPort = configuredPort("MOORKYZ_TOOLBAR_PORTAL_PORT", "4174");

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "**/*.spec.js",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:${fixturePort}`,
    browserName: "chromium",
    headless: true,
  },
  webServer: [
    {
      command: "node tests/browser/server.mjs",
      url: `http://127.0.0.1:${fixturePort}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: { MOORKYZ_TOOLBAR_FIXTURE_PORT: fixturePort },
    },
    {
      command: `pnpm --filter @moorkyz/portal exec next start --hostname 127.0.0.1 --port ${portalPort}`,
      url: `http://127.0.0.1:${portalPort}`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: {
        MOORKYZ_TOOLBAR_PORTAL_PORT: portalPort,
        NEXT_TELEMETRY_DISABLED: "1",
      },
    },
  ],
});
