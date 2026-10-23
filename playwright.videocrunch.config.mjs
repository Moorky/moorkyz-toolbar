import { defineConfig } from "@playwright/test";
import base from "./playwright.config.mjs";

export default defineConfig({
  ...base,
  testMatch: "**/local-service.spec.js",
  testIgnore: [],
  workers: 1,
  globalTeardown: "./tools/videocrunch/test/browser-teardown.js",
  webServer: [
    base.webServer[0],
    {
      ...base.webServer[1],
      reuseExistingServer: false,
      env: {
        ...base.webServer[1].env,
        MOORKYZ_VIDEOCRUNCH_ENABLED: "1",
        MOORKYZ_VIDEOCRUNCH_PORT: "8876",
      },
    },
    {
      command: "node tools/videocrunch/test/browser-fixture.js",
      url: "http://127.0.0.1:8876/api/config",
      reuseExistingServer: false,
      timeout: 30000,
    },
  ],
});
