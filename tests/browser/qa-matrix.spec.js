import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const origin = `http://127.0.0.1:${process.env.MOORKYZ_TOOLBAR_PORTAL_PORT ?? process.env.PORTAL_TEST_PORT ?? "4174"}`;
const widths = [320, 360, 390, 700, 701, 768, 900, 1024, 1440, 1920];

async function waitForViewportPaint(page) {
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
}

async function expectNavigationCollapseFits(page, viewportWidth) {
  const button = page.locator(
    ".toolbar-mount > .mzk-toolbar-host .mzk-toolbar__collapse",
  );
  await expect(button).toHaveAccessibleName("Collapse toolbar");
  const bounds = await button.boundingBox();
  if (bounds === null)
    throw new Error("The navigation collapse control is missing.");
  expect(bounds.width).toBeGreaterThanOrEqual(44);
  expect(bounds.height).toBeGreaterThanOrEqual(44);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewportWidth);
  if (viewportWidth <= 512) {
    const icon = await button.evaluate(
      (element) => getComputedStyle(element, "::before").content,
    );
    expect(icon).toBe('"−"');
  }
}

async function readPageOverflowState(page) {
  return page.evaluate(() => {
    const viewportWidth = window.innerWidth;
    const documentWidth = document.documentElement.scrollWidth;
    if (documentWidth <= viewportWidth) return { fits: true };

    const overflowingElements = [...document.body.querySelectorAll("*")]
      .map((element) => {
        const bounds = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          tag: element.tagName.toLowerCase(),
          id: element.id,
          className:
            typeof element.className === "string" ? element.className : "",
          text: element.textContent?.trim().replace(/\s+/g, " ").slice(0, 50),
          left: Math.round(bounds.left),
          right: Math.round(bounds.right),
          width: Math.round(bounds.width),
          position: style.position,
          overflowX: style.overflowX,
        };
      })
      .filter((element) => element.right > viewportWidth + 1)
      .sort((left, right) => right.right - left.right)
      .slice(0, 10);

    return {
      fits: false,
      viewportWidth,
      documentWidth,
      bodyWidth: document.body.scrollWidth,
      htmlOverflowX: getComputedStyle(document.documentElement).overflowX,
      bodyOverflowX: getComputedStyle(document.body).overflowX,
      overflowingElements,
    };
  });
}

test("Playground retains its original responsive gutters while other sections stay aligned", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(origin);
  await expect(
    page.getByRole("toolbar", { name: "Modern Workspace toolbar" }),
  ).toBeVisible();
  const playground = await page.locator("#playground").boundingBox();
  const engineering = await page.locator("#engineering").boundingBox();
  const quickstart = await page.locator("#quick-start").boundingBox();
  expect(playground.x).toBeCloseTo(36, 1);
  expect(playground.width).toBeGreaterThan(engineering.width);
  expect(Math.abs(quickstart.x - engineering.x)).toBeLessThan(1);
  expect(Math.abs(quickstart.width - engineering.width)).toBeLessThan(1);
  for (const [width, gutter] of [
    [320, 16],
    [1920, 40],
  ]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect
      .poll(async () => (await page.locator("#playground").boundingBox()).x)
      .toBeCloseTo(gutter, 1);
    await expect
      .poll(async () => {
        const state = await readPageOverflowState(page);
        return state.fits ? true : state;
      })
      .toBe(true);
  }
});

for (const route of ["/", "/studio", "/contributing"]) {
  test(`responsive, theme and keyboard audit of ${route}`, async ({
    page,
  }, testInfo) => {
    test.slow();
    const errors = [];
    page.on("pageerror", (cause) => errors.push(cause.message));
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${origin}${route}`);
    await expect(
      page.getByRole("button", { name: "Switch to dark theme" }),
    ).toBeEnabled();
    await page.evaluate(() => document.fonts.ready);
    await waitForViewportPaint(page);
    for (const theme of ["light", "dark"]) {
      if (theme === "dark") {
        await page
          .getByRole("button", { name: "Switch to dark theme" })
          .focus();
        await page
          .getByRole("button", { name: "Switch to dark theme" })
          .click();
      }
      for (const width of widths) {
        await page.setViewportSize({ width, height: 900 });
        await waitForViewportPaint(page);
        await expect
          .poll(async () => {
            const state = await readPageOverflowState(page);
            return state.fits ? true : state;
          })
          .toBe(true);
        await expectNavigationCollapseFits(page, width);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        await expect(page.locator("body")).toHaveAttribute("data-theme", theme);
        await waitForViewportPaint(page);
        if (width === 390 || width === 1440) {
          const scan = await new AxeBuilder({ page }).analyze();
          expect(scan.violations).toEqual([]);
          const file = testInfo.outputPath(
            `${route === "/" ? "home" : route.slice(1)}-${theme}-${width}.png`,
          );
          await page.screenshot({
            path: file,
            animations: "disabled",
            fullPage: true,
          });
          await testInfo.attach(`${route} ${theme} ${width}px`, {
            path: file,
            contentType: "image/png",
          });
        }
      }
    }
    expect(errors).toEqual([]);
  });
}

test("large text reflows without horizontal page overflow and keeps the search dialog usable", async ({
  page,
}) => {
  for (const route of ["/", "/studio", "/contributing"]) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${origin}${route}`);
    await expect(
      page.getByRole("button", { name: "Switch to dark theme" }),
    ).toBeEnabled();
    await page.evaluate(() => {
      const style = document.createElement("style");
      const owner = document.querySelector("style[nonce], script[nonce]");
      if (!owner) throw new Error("The production CSP nonce is missing.");
      style.nonce = owner.nonce;
      style.textContent = "html { font-size: 200%; }";
      document.head.append(style);
    });
    await waitForViewportPaint(page);
    await expect
      .poll(async () => {
        const state = await readPageOverflowState(page);
        return state.fits ? true : state;
      })
      .toBe(true);
    await expectNavigationCollapseFits(page, 390);
    await page
      .getByRole("button", {
        name: "Search documentation and navigation",
        exact: true,
      })
      .focus();
    await page
      .getByRole("button", {
        name: "Search documentation and navigation",
        exact: true,
      })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("searchbox")).toBeFocused();
    await dialog.getByRole("searchbox").fill("Vanilla");
    await expect(
      dialog.getByRole("link", { name: /Personalized Quick Start/ }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  }
});

test("all four applications and ten styles stay usable at constrained and wide widths", async ({
  page,
}) => {
  test.slow();
  await page.goto(origin);
  const playground = page.locator("#playground");
  await expect(
    playground.getByRole("button", { name: "Save locally" }),
  ).toBeEnabled();
  for (const width of [320, 768, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    if (width <= 700)
      await playground
        .getByRole("button", { name: "customize", exact: true })
        .click();
    const templates = playground.getByRole("button", {
      name: "Templates",
      exact: true,
    });
    if ((await templates.getAttribute("aria-expanded")) !== "true")
      await templates.click();
    await playground
      .getByRole("button", { name: "Application", exact: true })
      .click();
    for (const name of [
      "Modern Workspace",
      "Document Editor",
      "Analytics Dashboard",
      "Project Board",
    ]) {
      await playground
        .getByRole("button", { name: new RegExp(`^${name}`) })
        .click();
      await expect(
        playground.getByRole("toolbar", {
          name: `${name} toolbar`,
          includeHidden: true,
        }),
      ).toHaveCount(1);
    }
    await playground
      .getByRole("button", { name: "Toolbar Style", exact: true })
      .click();
    const names = await playground
      .locator(".template-card > button:first-child strong")
      .allTextContents();
    expect(names).toHaveLength(10);
    for (const name of names) {
      await playground
        .getByRole("button", { name: new RegExp(`^${name}`) })
        .click();
      if (width <= 700)
        await playground
          .getByRole("button", { name: "preview", exact: true })
          .click();
      for (const theme of ["light", "dark"]) {
        if ((await page.locator("html").getAttribute("data-theme")) !== theme) {
          const toggle = page.getByRole("button", {
            name: `Switch to ${theme} theme`,
          });
          await toggle.focus();
          await toggle.click();
        }
        const canvas = page.locator("#playground-canvas");
        await canvas.evaluate((element) =>
          element.scrollIntoView({ block: "start", behavior: "instant" }),
        );
        await expect(playground.getByRole("toolbar")).toHaveAttribute(
          "data-color-scheme",
          theme,
        );
        const bounds = await playground.getByRole("toolbar").boundingBox();
        const parent = await canvas.boundingBox();
        expect(bounds.width).toBeGreaterThan(0);
        expect(bounds.x).toBeGreaterThanOrEqual(parent.x - 1);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(
          parent.x + parent.width + 1,
        );
      }
      if (width <= 700)
        await playground
          .getByRole("button", { name: "customize", exact: true })
          .click();
    }
  }
});
