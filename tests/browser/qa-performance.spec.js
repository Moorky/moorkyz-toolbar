import { expect, test } from "@playwright/test";

const origin = `http://127.0.0.1:${process.env.MOORKYZ_TOOLBAR_PORTAL_PORT ?? process.env.PORTAL_TEST_PORT ?? "4174"}`;

test("record local web-vital, payload and user-journey observations without field-certification claims", async ({
  page,
  browserName,
  browser,
}, testInfo) => {
  test.slow();
  const observePerformance = () => {
    const supported = PerformanceObserver.supportedEntryTypes;
    const samples = { supported, lcp: null, cls: 0, events: [], longTasks: [] };
    window.__qaPerformance = samples;
    let sessionStart = 0,
      lastShift = 0,
      sessionValue = 0;
    function observe(type, callback) {
      if (!supported.includes(type)) return;
      new PerformanceObserver((list) =>
        list.getEntries().forEach(callback),
      ).observe({
        type,
        buffered: true,
        ...(type === "event" ? { durationThreshold: 16 } : {}),
      });
    }
    observe("largest-contentful-paint", (entry) => {
      samples.lcp = entry.startTime;
    });
    observe("layout-shift", (entry) => {
      if (entry.hadRecentInput) return;
      if (
        entry.startTime - lastShift > 1000 ||
        entry.startTime - sessionStart > 5000
      ) {
        sessionStart = entry.startTime;
        sessionValue = 0;
      }
      sessionValue += entry.value;
      lastShift = entry.startTime;
      samples.cls = Math.max(samples.cls, sessionValue);
    });
    observe("event", (entry) => {
      if (entry.interactionId && samples.events.length < 500)
        samples.events.push({
          interactionId: entry.interactionId,
          duration: entry.duration,
          name: entry.name,
        });
    });
    observe("longtask", (entry) => {
      if (samples.longTasks.length < 200)
        samples.longTasks.push({
          start: entry.startTime,
          duration: entry.duration,
        });
    });
  };
  await page.addInitScript(observePerformance);
  let cdp;
  if (browserName === "chromium") {
    cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  }
  const report = {
    scope:
      "Local headless lab, fresh browser context, normal local network; Chromium 4x CPU, other engines native. Not field INP, real-device certification or an approved release budget.",
    targets: { lcpMs: 2500, interactionMs: 200, cls: 0.1 },
    routes: [],
    journeys: [],
  };
  for (const route of ["/", "/studio", "/contributing"]) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    try {
      const measuredPage = await context.newPage();
      await measuredPage.addInitScript(observePerformance);
      if (browserName === "chromium") {
        const session = await context.newCDPSession(measuredPage);
        await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      }
      await measuredPage.goto(`${origin}${route}`);
      await expect(
        measuredPage.getByRole("button", { name: "Switch to dark theme" }),
      ).toBeEnabled();
      await measuredPage.evaluate(() => document.fonts.ready);
      await measuredPage.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      );
      const metrics = await measuredPage.evaluate(() => ({
        observation: window.__qaPerformance,
        payload: performance.getEntriesByType("resource").map((entry) => ({
          path: new URL(entry.name).pathname,
          bytes: entry.encodedBodySize,
          transferBytes: entry.transferSize,
          kind: entry.initiatorType,
        })),
      }));
      expect(metrics.payload.every(({ bytes }) => Number.isFinite(bytes))).toBe(
        true,
      );
      if (metrics.observation.lcp !== null)
        expect(metrics.observation.lcp).toBeGreaterThan(0);
      report.routes.push({ route, ...metrics });
    } finally {
      await context.close();
    }
  }
  await page.goto(origin);
  const playground = page.locator("#playground");
  await expect(playground.getByRole("toolbar")).toBeVisible();
  async function journey(name, action) {
    const start = await page.evaluate(() => performance.now());
    await action();
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    report.journeys.push({
      name,
      driverToNextFrameMs: await page.evaluate(
        (before) => performance.now() - before,
        start,
      ),
      observation: await page.evaluate(() => window.__qaPerformance),
    });
  }
  await journey("open Playground", () =>
    page
      .getByRole("link", { name: "Try the Playground", exact: false })
      .click(),
  );
  await journey("switch application", () =>
    playground.getByRole("button", { name: /^Document Editor/ }).click(),
  );
  await journey("choose toolbar style", async () => {
    await playground
      .getByRole("button", { name: "Toolbar Style", exact: true })
      .click();
    await playground.getByRole("button", { name: /^Segmented Dock/ }).click();
  });
  await journey("edit validated JSON", async () => {
    await playground
      .getByRole("button", { name: "Code & Export", exact: true })
      .click();
    const editor = playground.getByLabel("Playground configuration JSON");
    const design = JSON.parse(await editor.inputValue());
    design.geometry.radius = 16;
    await editor.fill(JSON.stringify(design));
    await playground
      .getByRole("button", { name: "Apply Playground JSON" })
      .click();
  });
  await journey("enter fullscreen", () =>
    playground
      .getByRole("button", { name: "Fullscreen preview", exact: true })
      .click(),
  );
  await page
    .locator("#playground-workspace")
    .getByRole("button", { name: "Exit fullscreen", exact: true })
    .click();
  const observation = await page.evaluate(() => window.__qaPerformance);
  const interactions = new Map();
  for (const entry of observation.events)
    interactions.set(
      entry.interactionId,
      Math.max(interactions.get(entry.interactionId) ?? 0, entry.duration),
    );
  const durations = [...interactions.values()].sort((a, b) => b - a);
  report.localInteractionObservation = durations.length
    ? durations[Math.floor(durations.length / 50)]
    : null;
  report.interactionNote =
    "Event Timing observed interactions, 16ms reporting threshold. Missing APIs/entries remain null, never a fabricated zero or field-INP claim. Driver timings include automation and are not INP.";
  const baselineHosts = await page.locator(".mzk-toolbar-host").count();
  for (let index = 0; index < 10; index++) {
    await page
      .getByRole("button", { name: "Expand Studio preview", exact: true })
      .click();
    await expect(
      page.locator(".studio-showcase").getByRole("toolbar"),
    ).toHaveCount(1);
    await page
      .getByRole("button", { name: "Collapse Studio preview", exact: true })
      .click();
    await expect(page.locator(".mzk-toolbar-host")).toHaveCount(baselineHosts);
  }
  report.lifecycle = {
    repeatedStudioMounts: 10,
    baselineHosts,
    remainingHosts: await page.locator(".mzk-toolbar-host").count(),
  };
  if (cdp) await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  await testInfo.attach("qa-web-vitals-and-journeys", {
    body: JSON.stringify(report, null, 2),
    contentType: "application/json",
  });
});
