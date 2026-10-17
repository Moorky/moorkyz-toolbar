import assert from "node:assert/strict";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("library mounts with Trusted Types enforcement and no default network demand", async ({
  page,
  baseURL,
}) => {
  const violations = [];
  const external = [];
  page.on("pageerror", (error) => violations.push(error.message));
  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener("securitypolicyviolation", (event) => {
      window.__cspViolations.push({
        directive: event.violatedDirective,
        blockedURI: event.blockedURI,
      });
    });
  });
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== new URL(baseURL).origin)
      external.push(request.url());
  });
  const response = await page.goto("/trusted-types");
  expect(response.headers()["content-security-policy"]).toContain(
    "trusted-types 'none'",
  );
  await expect(
    page.getByRole("toolbar", { name: "Application toolbar" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await expect(page.getByRole("status", { name: "Last action" })).toHaveText(
    "home",
  );
  expect(violations).toEqual([]);
  // Firefox's browser-owned favicon probe is intentionally denied by default-src.
  for (const violation of await page.evaluate(() => window.__cspViolations)) {
    expect(violation).toEqual({
      directive: "img-src",
      blockedURI: new URL("/favicon.ico", baseURL).href,
    });
  }
  expect(external).toEqual([]);
});

test("RTL large-text reduced-motion dock stays bounded and keyboard operable", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/");
  await page.evaluate(() => {
    document.documentElement.dir = "rtl";
    document.documentElement.style.fontSize = "200%";
  });
  const toolbar = page.getByRole("toolbar", { name: "Application toolbar" });
  const bounds = await toolbar.boundingBox();
  assert.ok(bounds);
  expect(bounds.x).toBeGreaterThanOrEqual(-1);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(321);
  const home = toolbar.getByRole("button", { name: "Home", exact: true });
  await home.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(
    toolbar.getByRole("button", { name: "Projects", exact: true }),
  ).toBeFocused();
  const scan = await new AxeBuilder({ page }).analyze();
  expect(scan.violations).toEqual([]);
});

test("repeated mounts have no retained hosts and record an unbudgeted performance baseline", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  const measurements = await page.evaluate(async () => {
    const { createToolbar } = await import("/toolbar/index.js");
    const samples = [];
    const target = document.createElement("div");
    document.body.append(target);
    for (let i = 0; i < 100; i++) {
      const start = performance.now();
      const controller = createToolbar(
        {
          features: { search: false, customize: false },
          actions: [{ id: "home", label: "Home" }],
        },
        { dispatchAction() {} },
      );
      const mounted = controller.mount(target);
      if (!mounted.ok) throw new Error(mounted.error.message);
      const updated = controller.update({
        actions: [{ id: "docs", label: "Docs" }],
      });
      if (!updated.ok) throw new Error(updated.error.message);
      controller.dispose();
      if (target.childElementCount !== 0)
        throw new Error("Retained host after disposal");
      samples.push(performance.now() - start);
    }
    target.remove();
    samples.sort((a, b) => a - b);
    return {
      iterations: samples.length,
      medianMountUpdateDisposeMs: samples[50],
      p95MountUpdateDisposeMs: samples[95],
    };
  });
  expect(measurements.iterations).toBe(100);
  await testInfo.attach("performance-baseline.json", {
    body: JSON.stringify(
      {
        ...measurements,
        note: "Observed baseline, not an approved numerical regression budget.",
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
});
