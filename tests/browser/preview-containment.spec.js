import { expect, test } from "@playwright/test";

const port =
  process.env.MOORKYZ_TOOLBAR_PORTAL_PORT ??
  process.env.PORTAL_TEST_PORT ??
  "4174";
const origin = `http://127.0.0.1:${port}`;

test("framework development UI does not paint an empty button and CSP remains strict", async ({
  page,
}) => {
  const response = await page.goto(origin);
  expect(response.headers()["content-security-policy"]).not.toContain(
    "unsafe-inline",
  );
  await expect(
    page.getByRole("button", { name: "Open Next.js Dev Tools", exact: true }),
  ).not.toBeVisible();
  const pageDock = page.getByRole("toolbar", {
    name: "Moorkyz Toolbar website navigation",
  });
  await expect(
    pageDock.getByRole("button", { name: "Customize toolbar", exact: true }),
  ).toBeVisible();
});

test("the preview toolbar stays inside its own application and clear of page customization", async ({
  page,
}) => {
  test.slow();
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const [width, height] of [
    [876, 474],
    [1024, 600],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto(origin);
    const canvas = page.locator("#playground-canvas");
    const footer = canvas.locator(".playground-toolbar");
    await expect(footer).toHaveAttribute("data-sticky", "true");
    const start = await canvas.evaluate(
      (element) => element.getBoundingClientRect().top + scrollY,
    );
    await expect(footer).toHaveAttribute("data-visible", "false");
    for (const offset of [-height, -300, -150, 0, 100]) {
      await page.evaluate(
        (top) => scrollTo({ top: Math.max(0, top), behavior: "instant" }),
        start + offset,
      );
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      );
      const visibilityState = await footer.evaluate((element) => ({
        visible: element.getAttribute("data-visible"),
        inert: element.hasAttribute("inert"),
      }));
      expect(visibilityState.inert).toBe(visibilityState.visible !== "true");
      if (visibilityState.visible !== "true") {
        continue;
      }
      const toolbar = canvas.getByRole("toolbar");
      const bounds = await toolbar.boundingBox();
      const stage = await canvas.locator(".playground-stage").boundingBox();
      const navigation = await page
        .getByRole("toolbar", { name: "Moorkyz Toolbar website navigation" })
        .boundingBox();
      expect(bounds.y).toBeGreaterThanOrEqual(stage.y - 1);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(
        stage.y + stage.height + 1,
      );
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(navigation.y + 1);
    }
    await canvas.evaluate((element) =>
      element.scrollIntoView({ block: "start", behavior: "instant" }),
    );
    await expect(canvas.getByRole("toolbar")).toBeVisible();
    const pageDock = page.getByRole("toolbar", {
      name: "Moorkyz Toolbar website navigation",
    });
    await pageDock
      .getByRole("button", { name: "Customize toolbar", exact: true })
      .click();
    await expect(
      pageDock.getByRole("button", { name: /finish customizing toolbar/ }),
    ).toBeVisible();
    await pageDock
      .getByRole("button", { name: /finish customizing toolbar/ })
      .click();
    await canvas.evaluate((element) =>
      element.scrollIntoView({ block: "start", behavior: "instant" }),
    );
    await canvas.getByRole("button", { name: "New task", exact: true }).click();
    await expect(page.getByLabel("New task title")).toBeFocused();
  }
});

test("preview containment still works without ResizeObserver", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.ResizeObserver = undefined;
  });
  await page.goto(origin);
  const footer = page.locator("#playground-canvas .playground-toolbar");
  await page
    .locator("#playground-canvas")
    .evaluate((element) =>
      element.scrollIntoView({ block: "start", behavior: "instant" }),
    );
  await expect(footer).toHaveAttribute("data-sticky", "true");
  await expect(footer).toHaveAttribute("data-visible", "true");
  await expect(footer).toHaveCSS("position", "sticky");
});
