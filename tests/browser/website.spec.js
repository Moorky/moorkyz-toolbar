import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const origin = `http://127.0.0.1:${process.env.MOORKYZ_TOOLBAR_PORTAL_PORT ?? process.env.PORTAL_TEST_PORT ?? "4174"}`;

test("header uses the supplied logo at the current size without clipping responsive navigation", async ({
  page,
}, testInfo) => {
  for (const route of ["/", "/studio", "/contributing"]) {
    await page.goto(`${origin}${route}`);
    const header = page.locator(".adaptive-header");
    const logo = header.locator(".brand img");
    await expect(logo).toHaveJSProperty("naturalWidth", 512);
    await expect(logo).toHaveAttribute("src", "/moorkyz-toolbar-logo.png");
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const bounds = await logo.boundingBox();
      const parent = await header.boundingBox();
      expect(bounds.width).toBeCloseTo(112, 2);
      expect(bounds.height).toBeCloseTo(56, 2);
      await expect(logo).toHaveCSS("object-fit", "cover");
      expect(bounds.y).toBeGreaterThanOrEqual(parent.y);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(
        parent.y + parent.height + 1,
      );
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        )
        .toBe(true);
      await expect(
        header.getByRole("link", { name: "Playground", exact: true }),
      ).toBeVisible();
      await expect(
        header.getByRole("button", {
          name: "Search documentation and navigation",
          exact: true,
        }),
      ).toBeVisible();
      if (route === "/" && (width === 320 || width === 1440)) {
        const path = testInfo.outputPath(`header-logo-${width}.png`);
        await header.screenshot({ path });
        await testInfo.attach(`Header logo at ${width}px`, {
          path,
          contentType: "image/png",
        });
      }
    }
    expect(
      (await new AxeBuilder({ page }).include(".adaptive-header").analyze())
        .violations,
    ).toEqual([]);
    await header.locator(".brand").focus();
    await expect(header.locator(".brand")).toBeFocused();
  }
});

test("landing structure, real links, local typography and exact footer branding match the MVP", async ({
  page,
}) => {
  const external = [];
  page.on("request", (request) => {
    if (!request.url().startsWith(`${origin}/`)) external.push(request.url());
  });
  const response = await page.goto(origin);
  expect(response.headers()["content-security-policy"]).not.toContain(
    "unsafe-inline",
  );
  await expect(
    page.getByRole("heading", {
      name: "One toolbar. Every interface.",
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await page
      .locator("main")
      .evaluate((main) =>
        [...main.querySelectorAll("section[id]")].map(({ id }) => id),
      ),
  ).toEqual([
    "home",
    "playground",
    "quick-start",
    "environments",
    "studio",
    "docs",
    "engineering",
    "open-source",
    "finish",
  ]);
  await expect(
    page.getByRole("link", { name: "Try the Playground", exact: false }),
  ).toHaveAttribute("href", "#playground");
  await expect(
    page.getByRole("link", { name: "powered by Moorkyz", exact: true }),
  ).toHaveAttribute("href", "https://moorkyz.com");
  await expect(
    page
      .locator(".footer-upper")
      .getByRole("link", { name: "Studio", exact: true }),
  ).toHaveAttribute("href", "/studio");
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page.evaluate(() =>
      [...document.fonts]
        .filter((font) => font.status === "loaded")
        .map((font) => font.family),
    ),
  ).toEqual(expect.arrayContaining(["DM Sans", "DM Mono"]));
  expect((await page.request.get(`${origin}/fonts/DMSans-OFL.txt`)).ok()).toBe(
    true,
  );
  expect((await page.request.get(`${origin}/fonts/DMMono-OFL.txt`)).ok()).toBe(
    true,
  );
  expect(external).toEqual([]);
  await page
    .getByRole("link", { name: "Contribution guidelines", exact: false })
    .click();
  await expect(page).toHaveURL(`${origin}/contributing`);
  await expect(
    page.getByRole("heading", {
      name: "Build something thoughtful.",
      exact: true,
    }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("local command search returns real results and respects editor shortcut ownership", async ({
  page,
}) => {
  await page.goto(origin);
  await expect(page.getByLabel("New task title")).toBeEnabled();
  await page.getByLabel("New task title").focus();
  await expect(page.getByLabel("New task title")).toBeFocused();
  await page.keyboard.press("ControlOrMeta+k");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByRole("heading", {
      name: "One toolbar. Every interface.",
      exact: true,
    })
    .click();
  await page.keyboard.press("ControlOrMeta+Shift+k");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.keyboard.press("ControlOrMeta+k");
  const dialog = page.getByRole("dialog", { name: "Find your next step." });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("searchbox").fill("no-such-reference");
  await expect(dialog.getByRole("status")).toContainText(
    "No matching reference",
  );
  await dialog.getByRole("searchbox").fill("scenario");
  await dialog.getByRole("link", { name: /Scenario Lab/ }).click();
  await expect(page).toHaveURL(`${origin}/studio#scenario-lab`);
  await expect(
    page.getByRole("toolbar", { name: "Scenario Lab toolbar" }),
  ).toBeVisible();
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
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Search documentation and navigation",
      exact: true,
    }),
  ).toBeFocused();
});

test("capability explorer switches genuine SDK demonstrations and architecture follows actual boundaries", async ({
  page,
}) => {
  await page.goto(origin);
  const explorer = page.locator(".capability-explorer");
  await explorer.getByRole("button", { name: /^Responsive overflow/ }).click();
  const preview = explorer.getByRole("toolbar", {
    name: "Component lab toolbar",
  });
  await expect(
    preview.getByRole("button", { name: "Scroll toolbar actions toward end" }),
  ).toBeVisible();
  await explorer.getByRole("button", { name: /^Search & surfaces/ }).click();
  await preview.getByRole("button", { name: "Search", exact: true }).click();
  await expect(
    explorer.getByRole("searchbox", {
      name: "Search toolbar actions and content",
    }),
  ).toBeVisible();
  await explorer.getByRole("button", { name: /^Trusted extensions/ }).click();
  await expect(
    explorer.getByRole("button", { name: "Register trusted recipe" }),
  ).toBeVisible();
  const architecture = page.locator(".architecture-explorer");
  await architecture
    .getByRole("button", { name: "Framework adapters", exact: true })
    .click();
  await expect(
    architecture.getByLabel("Framework adapters code example"),
  ).toContainText("@moorkyz/toolbar/react");
  await expect(
    architecture.getByRole("link", { name: /Inspect the actual source/ }),
  ).toHaveAttribute(
    "href",
    "https://github.com/Moorky/moorkyz-toolbar/tree/master/examples",
  );
});

test("Studio expands lazily, opens a dedicated route and all real previews follow global variants", async ({
  page,
}) => {
  await page.goto(origin);
  const showcase = page.locator(".studio-showcase");
  await expect(showcase.getByRole("toolbar")).toHaveCount(0);
  await showcase.getByRole("button", { name: "Expand Studio preview" }).click();
  await expect(
    showcase.getByRole("toolbar", { name: "Component lab toolbar" }),
  ).toBeVisible();
  await showcase
    .getByRole("button", { name: "Collapse Studio preview" })
    .click();
  await expect(showcase.getByRole("toolbar")).toHaveCount(0);
  await showcase.getByRole("link", { name: /Open Development Studio/ }).click();
  await expect(
    page.getByRole("heading", { name: "Development Studio.", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Switch to dark theme" }).focus();
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect
    .poll(async () =>
      page
        .locator("main [role=toolbar]")
        .evaluateAll(
          (toolbars) =>
            toolbars.length >= 6 &&
            toolbars.every(
              (toolbar) => toolbar.getAttribute("data-color-scheme") === "dark",
            ),
        ),
    )
    .toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("Studio custom palettes retain separate global light and dark variants", async ({
  page,
}) => {
  await page.goto(`${origin}/studio`);
  const studio = page.locator("#theme-studio");
  await studio.getByLabel("foreground", { exact: true }).fill("#112233");
  await studio.getByRole("button", { name: "Apply custom theme" }).click();
  await page.getByRole("button", { name: "Switch to dark theme" }).focus();
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(
    studio.getByLabel("foreground", { exact: true }),
  ).not.toHaveValue("#112233");
  await studio.getByLabel("background", { exact: true }).fill("#101020");
  await studio.getByRole("button", { name: "Apply custom theme" }).click();
  await page.getByRole("button", { name: "Switch to light theme" }).focus();
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await expect(studio.getByLabel("foreground", { exact: true })).toHaveValue(
    "#112233",
  );
  await expect(studio.getByRole("toolbar")).toHaveAttribute(
    "data-color-scheme",
    "light",
  );
});

test("final CTAs preserve the design and site-dock color controls synchronize the global theme", async ({
  page,
}) => {
  await page.goto(origin);
  const playground = page.locator("#playground");
  await playground
    .getByRole("button", { name: "Actions", exact: true })
    .click();
  await playground.getByLabel("Label for add-task").fill("Keep my design");
  await page
    .locator("#finish")
    .getByRole("link", { name: "Design a Toolbar", exact: true })
    .click();
  await expect(
    playground
      .getByRole("toolbar")
      .getByRole("button", { name: "Keep my design", exact: true }),
  ).toBeVisible();
  await page
    .locator("#finish")
    .getByRole("link", { name: "Start Building", exact: true })
    .click();
  await expect(
    page.getByLabel("Personalized Vanilla integration source"),
  ).toContainText("Keep my design");
  const dock = page.getByRole("toolbar", {
    name: "Moorkyz Toolbar website navigation",
  });
  await dock
    .getByRole("button", { name: "Customize toolbar", exact: true })
    .click();
  await dock.getByRole("button", { name: /Change color scheme/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page
    .locator("#playground-canvas")
    .evaluate((element) =>
      element.scrollIntoView({ block: "start", behavior: "instant" }),
    );
  await expect(
    playground.locator(".playground-toolbar [role='toolbar']"),
  ).toHaveAttribute("data-color-scheme", "dark");
});

test("adaptive header remains keyboard reachable and mobile has no overflowing panels", async ({
  page,
}) => {
  await page.goto(origin);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(
    page.getByRole("button", { name: "Switch to dark theme" }),
  ).toBeEnabled();
  const header = page.locator(".adaptive-header");
  expect((await header.boundingBox()).height).toBeLessThanOrEqual(72);
  await page.evaluate(() => scrollTo({ top: 900, behavior: "instant" }));
  await expect(header).toHaveAttribute("data-hidden", "true");
  await page.evaluate(() => scrollTo({ top: 600, behavior: "instant" }));
  await expect(header).toHaveAttribute("data-hidden", "false");
  await page.evaluate(() => scrollTo({ top: 1000, behavior: "instant" }));
  await header.getByRole("link", { name: "Playground", exact: true }).focus();
  await expect(header).toHaveAttribute("data-hidden", "false");
  await page.setViewportSize({ width: 360, height: 780 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
