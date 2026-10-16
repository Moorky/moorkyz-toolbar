import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "**/*.spec.js",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    browserName: "chromium",
    headless: true,
  },
  webServer: [
    {
      command: "node tests/browser/server.mjs",
      url: "http://127.0.0.1:4173/health",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command:
        "pnpm --filter @moorkyz/portal exec next start --hostname 127.0.0.1 --port 4174",
      url: "http://127.0.0.1:4174",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: { NEXT_TELEMETRY_DISABLED: "1" },
    },
  ],
});
