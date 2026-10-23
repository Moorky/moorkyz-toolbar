import { expect, test } from "@playwright/test";

const origin = `http://127.0.0.1:${process.env.MOORKYZ_TOOLBAR_PORTAL_PORT ?? process.env.PORTAL_TEST_PORT ?? "4174"}`;
const styles = [
  ["Minimal Floating Pill", 32, 60],
  ["Compact Capsule", 24, 56],
  ["Rounded Rectangle", 10, 64],
  ["Segmented Dock", 14, 64],
  ["Full-Width Bottom Dock", 0, 64],
  ["Frosted Glass", 18, 68],
  ["Outward Trapezoid", 0, 68],
  ["Multi-Faceted Dock", 0, 64],
  ["Minimal Edge Strip", 0, 56],
  ["Angular Floating Toolbar", 4, 60],
];

test("structural visual regression: ten rendered silhouettes preserve exact geometry and usable targets", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${origin}/tools/toolbar/playground`);
  const playground = page.locator("#playground");
  const canvas = page.locator("#playground-canvas");
  await expect(playground.getByRole("toolbar")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect(playground.locator(".mobile-workspace-modes")).not.toBeVisible();
  await expect(
    playground.getByRole("button", { name: "Resize settings sheet" }),
  ).not.toBeVisible();
  await expect(playground.locator(".template-list")).toHaveCSS(
    "display",
    "grid",
  );
  await expect(playground.locator(".template-thumbnail").first()).toHaveCSS(
    "display",
    "grid",
  );
  await playground
    .getByRole("button", { name: "Toolbar Style", exact: true })
    .click();
  const signatures = [];
  for (const [name, radius, height] of styles) {
    await playground
      .getByRole("button", { name: new RegExp(`^${name}`) })
      .click();
    const toolbar = playground.getByRole("toolbar");
    await expect
      .poll(async () => Math.round((await toolbar.boundingBox()).height))
      .toBe(height);
    await expect(toolbar).toHaveCSS("border-radius", `${radius}px`);
    const signature = await toolbar.evaluate((element) => {
      const computed = getComputedStyle(element);
      const pseudo = getComputedStyle(element, "::before");
      return [
        computed.borderRadius,
        element.getBoundingClientRect().height,
        computed.gap,
        computed.backdropFilter,
        computed.borderStyle,
        pseudo.clipPath,
      ].join("|");
    });
    signatures.push(signature);
    const bounds = await toolbar.boundingBox();
    const container = await canvas.boundingBox();
    if (name === "Outward Trapezoid" || name === "Multi-Faceted Dock")
      expect(
        await toolbar.evaluate(
          (element) => getComputedStyle(element, "::before").clipPath,
        ),
      ).toContain("polygon(");
    if (name === "Frosted Glass")
      await expect(toolbar).toHaveCSS("backdrop-filter", "blur(20px)");
    if (name === "Full-Width Bottom Dock" || name === "Minimal Edge Strip")
      expect(Math.abs(bounds.width - (container.width - 24))).toBeLessThan(1);
    expect(bounds.x).toBeGreaterThanOrEqual(container.x);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(
      container.x + container.width + 1,
    );
    await canvas.evaluate((element) =>
      element.scrollIntoView({ block: "start", behavior: "instant" }),
    );
    const path = testInfo.outputPath(
      `style-${name.toLowerCase().replaceAll(" ", "-")}.png`,
    );
    await canvas.screenshot({ path, animations: "disabled", caret: "hide" });
    await testInfo.attach(name, { path, contentType: "image/png" });
  }
  expect(new Set(signatures).size).toBe(10);
  await playground
    .getByRole("button", { name: "Fullscreen preview", exact: true })
    .click();
  await expect
    .poll(() =>
      page
        .locator("#playground-workspace")
        .evaluate((element) =>
          Math.abs(element.getBoundingClientRect().height - window.innerHeight),
        ),
    )
    .toBeLessThan(1);
  await page
    .locator("#playground-workspace")
    .getByRole("button", { name: "Exit fullscreen", exact: true })
    .click();
});

test("mobile visual regression: extreme valid geometry retains 44px targets without covering page navigation", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${origin}/tools/toolbar/playground`);
  const playground = page.locator("#playground");
  await expect(
    playground.getByRole("button", { name: "Save locally" }),
  ).toBeEnabled();
  await playground.getByRole("button", { name: "code", exact: true }).click();
  const editor = playground.getByLabel("Playground configuration JSON");
  const design = JSON.parse(await editor.inputValue());
  Object.assign(design.geometry, {
    width: 320,
    height: 56,
    offsetX: 128,
    offsetY: 0,
    gap: 24,
  });
  Object.assign(design.appearance, {
    fontSize: 18,
    iconSize: 24,
    borderWidth: 4,
  });
  design.style = "trapezoid";
  design.actions.forEach((action) => {
    action.icon = "star";
  });
  await editor.fill(JSON.stringify(design));
  await playground
    .getByRole("button", { name: "Apply Playground JSON" })
    .click();
  await playground
    .getByRole("button", { name: "preview", exact: true })
    .click();
  const canvas = page.locator("#playground-canvas");
  await canvas.evaluate((element) =>
    element.scrollIntoView({ block: "start", behavior: "instant" }),
  );
  const toolbar = playground.getByRole("toolbar");
  await expect
    .poll(async () => Math.round((await toolbar.boundingBox()).height))
    .toBe(56);
  expect(
    (await toolbar.locator(".mzk-toolbar__actions").boundingBox()).width,
  ).toBeGreaterThanOrEqual(44);
  for (const button of await toolbar.getByRole("button").all()) {
    const bounds = await button.boundingBox();
    expect(bounds.width).toBeGreaterThanOrEqual(44);
    expect(bounds.height).toBeGreaterThanOrEqual(44);
  }
  const preview = await toolbar.boundingBox();
  const nav = await page
    .getByRole("toolbar", { name: "Moorkyz Toolbar website navigation" })
    .boundingBox();
  expect(
    Math.max(
      0,
      Math.min(preview.y + preview.height, nav.y + nav.height) -
        Math.max(preview.y, nav.y),
    ),
  ).toBe(0);
  await page.getByRole("button", { name: "Switch to dark theme" }).focus();
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await canvas.evaluate((element) =>
    element.scrollIntoView({ block: "start", behavior: "instant" }),
  );
  await page.evaluate(() => document.fonts.ready);
  const path = testInfo.outputPath("mobile-dark-extreme-geometry.png");
  await canvas.screenshot({ path, animations: "disabled", caret: "hide" });
  await testInfo.attach("Mobile dark layout", {
    path,
    contentType: "image/png",
  });
});

test("local portal performance measurements are recorded without inventing approved budgets", async ({
  page,
}, testInfo) => {
  const samples = [];
  for (let index = 0; index < 3; index++) {
    await page.goto(`${origin}/tools/toolbar/playground`);
    await expect(
      page.locator('#playground-canvas [role="toolbar"]'),
    ).toHaveCount(1);
    await page.evaluate(() => document.fonts.ready);
    samples.push(
      await page.evaluate(() => {
        const navigation = performance.getEntriesByType("navigation")[0];
        return {
          navigationMs: navigation.duration,
          resourceBytes: performance
            .getEntriesByType("resource")
            .reduce((sum, entry) => sum + entry.transferSize, 0),
        };
      }),
    );
  }
  for (const sample of samples) {
    expect(Number.isFinite(sample.navigationMs)).toBe(true);
    expect(sample.navigationMs).toBeGreaterThanOrEqual(0);
  }
  const sorted = samples
    .map(({ navigationMs }) => navigationMs)
    .sort((a, b) => a - b);
  await testInfo.attach("local-portal-performance", {
    body: JSON.stringify({
      samples,
      medianMs: sorted[1],
      p95Ms: sorted[2],
      scope:
        "Local browser navigation; shared Windows environment; cold plus cached samples; not device/network certification or an approved budget.",
    }),
    contentType: "application/json",
  });
});
