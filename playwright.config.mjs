import { defineConfig } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const portalTestPort = process.env.PORTAL_TEST_PORT ?? "4174";
const repositoryRoot = path.dirname(fileURLToPath(import.meta.url));
const standaloneRoot = path.resolve(
  repositoryRoot,
  "packages/portal/.next/standalone",
);

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
      command: "node packages/portal/server.js",
      url: `http://127.0.0.1:${portalTestPort}`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      cwd: standaloneRoot,
      env: {
        HOSTNAME: "127.0.0.1",
        NEXT_TELEMETRY_DISABLED: "1",
        NODE_ENV: "production",
        PORT: portalTestPort,
      },
    },
  ],
});
