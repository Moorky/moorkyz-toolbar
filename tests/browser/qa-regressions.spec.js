import { expect, test } from "@playwright/test";

const origin = `http://127.0.0.1:${process.env.MOORKYZ_TOOLBAR_PORTAL_PORT ?? process.env.PORTAL_TEST_PORT ?? "4174"}`;
const playgroundKey = "moorkyz-toolbar:portal:playground:design:v2";

test("inactive editor panels acquire no controls and raw buffers survive panel changes", async ({
  page,
}) => {
  const playground = await open(page);
  await expect(
    playground.locator(".playground-accordion textarea"),
  ).toHaveCount(0);
  await playground
    .getByRole("button", { name: "Code & Export", exact: true })
    .click();
  await playground.getByLabel("Playground configuration JSON").fill("{");
  await playground
    .getByRole("button", { name: "Templates", exact: true })
    .click();
  await expect(
    playground.locator(".playground-accordion textarea"),
  ).toHaveCount(0);
  await playground
    .getByRole("button", { name: "Code & Export", exact: true })
    .click();
  await expect(
    playground.getByLabel("Playground configuration JSON"),
  ).toHaveValue("{");
  await playground
    .getByRole("button", { name: "Discard JSON edits", exact: true })
    .click();
});

test("unapplied JSON warns before reload and deliberate discard restores normal navigation", async ({
  page,
}) => {
  const playground = await open(page);
  await playground
    .getByRole("button", { name: "Code & Export", exact: true })
    .click();
  const editor = playground.getByLabel("Playground configuration JSON");
  await editor.click();
  await editor.fill("{");
  const dialogReady = page.waitForEvent("dialog");
  const navigation = page.reload({ timeout: 3000 }).then(
    () => null,
    (cause) => cause.message,
  );
  const dialog = await dialogReady;
  expect(dialog.type()).toBe("beforeunload");
  await dialog.dismiss();
  await expect(editor).toHaveValue("{");
  expect(await navigation).toMatch(
    /timeout|aborted|interrupted|cancelled|NS_BINDING_ABORTED/i,
  );
  await playground
    .getByRole("button", { name: "Discard JSON edits", exact: true })
    .click();
  await page.reload();
  await page
    .locator("#playground-canvas")
    .evaluate((element) =>
      element.scrollIntoView({ block: "start", behavior: "instant" }),
    );
  await expect(playground.getByRole("toolbar")).toBeVisible();
});

test("document commands remain bounded under rapid invocation and retain Unicode selection", async ({
  page,
}) => {
  const playground = await open(page);
  await playground.getByRole("button", { name: /^Document Editor/ }).click();
  const editor = playground.getByLabel("Document content");
  const toolbar = playground.getByRole("toolbar");
  await editor.fill("straße");
  await editor.focus();
  await page.keyboard.press("ControlOrMeta+A");
  await toolbar.getByRole("button", { name: "Uppercase selection" }).click();
  await expect(editor).toHaveValue("STRASSE");
  expect(
    await editor.evaluate(
      (element) => element.selectionEnd - element.selectionStart,
    ),
  ).toBe(7);
  await editor.fill("x".repeat(9980));
  await toolbar
    .getByRole("button", { name: "Add heading", exact: true })
    .evaluate((button) => {
      for (let index = 0; index < 50; index++) button.click();
    });
  expect((await editor.inputValue()).length).toBeLessThanOrEqual(10000);
  await expect(playground.locator(".playground-status")).toContainText(
    "10,000 characters",
  );
});

async function open(page, width = 1440, height = 1000) {
  await page.setViewportSize({ width, height });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${origin}/tools/toolbar/playground`);
  await page
    .locator("#playground-canvas")
    .evaluate((element) =>
      element.scrollIntoView({ block: "start", behavior: "instant" }),
    );
  const playground = page.locator("#playground");
  await expect(
    playground.getByRole("button", { name: "Save locally" }),
  ).toBeEnabled();
  await expect(playground.getByRole("toolbar")).toBeVisible();
  return playground;
}

test("mobile fullscreen fallback retains settings, code, keyboard dismissal and focus restoration", async ({
  page,
}) => {
  await page.addInitScript(() => {
    HTMLElement.prototype.requestFullscreen = () =>
      Promise.reject(
        new DOMException("Synthetic denied fullscreen", "NotAllowedError"),
      );
  });
  const playground = await open(page, 360, 780);
  const enter = playground.getByRole("button", {
    name: "Fullscreen preview",
    exact: true,
  });
  await enter.click();
  const workspace = page.locator("#playground-workspace");
  await expect(workspace).toHaveAttribute("data-focus", "true");
  await expect(workspace.locator(".workspace-fullscreen-status")).toContainText(
    "fullscreen was denied",
  );
  await page.setViewportSize({ width: 360, height: 780 });
  await workspace
    .getByRole("button", { name: "customize", exact: true })
    .click();
  await workspace
    .getByRole("button", { name: "Appearance", exact: true })
    .click();
  await expect
    .poll(async () => {
      const panel = await workspace
        .locator(".playground-sidebar")
        .boundingBox();
      const heading = await workspace
        .getByRole("button", { name: "Appearance", exact: true })
        .boundingBox();
      return (
        heading.y >= panel.y - 1 &&
        heading.y + heading.height <= panel.y + panel.height + 1
      );
    })
    .toBe(true);
  await expect(workspace.getByLabel("Edit theme variant")).toBeVisible();
  await expect(page.locator("#playground-canvas")).toHaveAttribute("inert", "");
  await workspace.getByRole("button", { name: "code", exact: true }).click();
  await workspace.getByLabel("Playground configuration JSON").fill("{");
  await workspace.getByRole("button", { name: "preview", exact: true }).click();
  await workspace.getByRole("button", { name: "code", exact: true }).click();
  await expect(
    workspace.getByLabel("Playground configuration JSON"),
  ).toHaveValue("{");
  await workspace
    .getByRole("button", { name: "Exit fullscreen", exact: true })
    .click();
  await expect(enter).toBeFocused();
  await playground
    .getByRole("button", { name: "preview", exact: true })
    .click();
  await expect(page.locator("#playground-canvas")).not.toHaveAttribute(
    "inert",
    "",
  );
});

test("native fullscreen preserves access to controls at the browser's actual fullscreen viewport", async ({
  page,
}) => {
  const playground = await open(page, 390, 844);
  await playground
    .getByRole("button", { name: "Fullscreen preview", exact: true })
    .click();
  const workspace = page.locator("#playground-workspace");
  await expect(workspace).toHaveAttribute("data-focus", "true");
  if (await page.evaluate(() => innerWidth <= 700))
    await workspace
      .getByRole("button", { name: "customize", exact: true })
      .click();
  await workspace.getByRole("button", { name: "Actions", exact: true }).click();
  await workspace.getByLabel("Label for add-task").fill("Edited in fullscreen");
  await workspace
    .getByRole("button", { name: "Exit fullscreen", exact: true })
    .click();
  if (await page.evaluate(() => innerWidth <= 700))
    await playground
      .getByRole("button", { name: "preview", exact: true })
      .click();
  await expect(
    playground
      .getByRole("toolbar")
      .getByRole("button", { name: "Edited in fullscreen", exact: true }),
  ).toBeVisible();
});

test("Studio theme changes preserve manually collapsed previews and custom-theme application", async ({
  page,
}) => {
  await page.goto(`${origin}/studio`);
  const studio = page.locator("#theme-studio");
  const toolbar = studio.getByRole("toolbar");
  await toolbar
    .getByRole("button", { name: "Collapse toolbar", exact: true })
    .click();
  await page.getByRole("button", { name: "Switch to dark theme" }).focus();
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(
    toolbar.getByRole("button", { name: "Restore toolbar", exact: true }),
  ).toBeVisible();
  await studio.getByLabel("foreground", { exact: true }).fill("#eeeeff");
  await studio.getByRole("button", { name: "Apply custom theme" }).click();
  await expect(
    toolbar.getByRole("button", { name: "Restore toolbar", exact: true }),
  ).toBeVisible();
});

test("clipboard failures are visible and generated code uses the actual DM Mono face", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: () =>
          Promise.reject(
            new DOMException("Synthetic denied clipboard", "NotAllowedError"),
          ),
      },
    });
  });

  await open(page);
  const quickstart = page.locator("#quick-start");
  await quickstart
    .getByRole("button", { name: "Copy personalized source" })
    .click();
  await expect(quickstart.getByRole("status")).toBeVisible();
  await expect(quickstart.getByRole("status")).toContainText("Could not copy");
  await expect(quickstart.locator("pre code")).toHaveCSS(
    "font-family",
    /DM Mono/,
  );
});

test("application input drafts remain isolated and resetting another app does not discard them", async ({
  page,
}) => {
  const playground = await open(page);
  await playground.getByLabel("New task title").fill("Workspace draft");
  await playground.getByRole("button", { name: /^Project Board/ }).click();
  await expect(playground.getByLabel("New card title")).toHaveValue("");
  await playground.getByLabel("New card title").fill("Board draft");
  await playground.getByRole("button", { name: /^Document Editor/ }).click();
  await playground
    .getByRole("button", { name: "Reset sample application" })
    .click();
  await playground.getByRole("button", { name: /^Modern Workspace/ }).click();
  await expect(playground.getByLabel("New task title")).toHaveValue(
    "Workspace draft",
  );
  await playground.getByRole("button", { name: /^Project Board/ }).click();
  await expect(playground.getByLabel("New card title")).toHaveValue(
    "Board draft",
  );
});

test("preview and page-navigation docks do not collide across intermediate scroll positions", async ({
  page,
}) => {
  const playground = await open(page, 768, 800);
  const canvas = page.locator("#playground-canvas");
  const start = await canvas.evaluate(
    (element) => element.getBoundingClientRect().top + scrollY,
  );
  for (const offset of [-400, -300, -200, -100, 0, 100]) {
    await page.evaluate(
      (top) => scrollTo({ top, behavior: "instant" }),
      start + offset,
    );
    await expect
      .poll(async () => {
        const preview = await playground.getByRole("toolbar").boundingBox();
        const navigation = await page
          .getByRole("toolbar", { name: "Moorkyz Toolbar website navigation" })
          .boundingBox();
        return Math.max(
          0,
          Math.min(
            preview.y + preview.height,
            navigation.y + navigation.height,
          ) - Math.max(preview.y, navigation.y),
        );
      })
      .toBe(0);
  }
});

test("geometry edits preserve the SDK action node, exact X movement and top-anchor drag direction", async ({
  page,
}) => {
  const playground = await open(page);
  await playground
    .getByRole("button", { name: "Geometry & Position", exact: true })
    .click();
  await page
    .locator("#playground-canvas")
    .evaluate((element) =>
      element.scrollIntoView({ block: "start", behavior: "instant" }),
    );
  const toolbar = playground.getByRole("toolbar");
  const action = toolbar.getByRole("button", { name: "New task", exact: true });
  const original = await action.elementHandle();
  const before = await toolbar.boundingBox();
  await playground.getByLabel("Toolbar offsetX", { exact: true }).fill("16");
  await expect
    .poll(async () => Math.round((await toolbar.boundingBox()).x - before.x))
    .toBe(16);
  expect(await original.evaluate((element) => element.isConnected)).toBe(true);
  await playground
    .getByRole("combobox", { name: "Position", exact: true })
    .selectOption("top");
  await playground.getByLabel("Toolbar offsetY", { exact: true }).fill("0");
  await playground.getByLabel("Edit Mode", { exact: true }).check();
  const move = playground.getByRole("button", {
    name: "Move toolbar",
    exact: true,
  });
  await move.hover();
  const bounds = await move.boundingBox();
  await page.mouse.down();
  await page.mouse.move(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2 + 24,
    { steps: 3 },
  );
  await page.mouse.up();
  await expect(
    playground.getByLabel("Toolbar offsetY", { exact: true }),
  ).toHaveValue("24");
});

test("export API failures are visible and valid configuration remains recoverable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    URL.createObjectURL = () => {
      throw new Error("Synthetic unavailable download");
    };
  });
  const errors = [];
  page.on("pageerror", (cause) => errors.push(cause.message));
  const playground = await open(page);
  await playground
    .getByRole("button", { name: "Code & Export", exact: true })
    .click();
  const initial = await playground
    .getByLabel("Playground configuration JSON")
    .inputValue();
  await playground
    .getByRole("button", { name: "Download design", exact: true })
    .click();
  await expect(playground.locator(".playground-status")).toContainText(
    "Could not export",
  );
  await expect(
    playground.getByLabel("Playground configuration JSON"),
  ).toHaveValue(initial);
  expect(errors).toEqual([]);
});

test("quota failures retain current design and explicit replacement snapshots", async ({
  page,
}) => {
  const playground = await open(page);
  await playground.getByRole("button", { name: "Save locally" }).click();
  const original = await page.evaluate(
    (key) => localStorage.getItem(key),
    playgroundKey,
  );
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    };
  });
  await playground
    .getByRole("button", { name: "Actions", exact: true })
    .click();
  await playground
    .getByLabel("Label for add-task")
    .fill("Recoverable after quota failure");
  await expect(playground.locator(".playground-status")).toContainText(
    "Autosave could not",
  );
  await expect(
    playground.getByRole("toolbar").getByRole("button", {
      name: "Recoverable after quota failure",
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), playgroundKey),
  ).toBe(original);
});

test("generation failures are explicit and can be retried without editing a valid design", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const digest = crypto.subtle.digest.bind(crypto.subtle);
    crypto.subtle.digest = (...args) => {
      if (!localStorage.getItem("qa-integrity-restored"))
        return Promise.reject(new Error("Synthetic integrity failure"));
      return digest(...args);
    };
  });
  await open(page);
  await expect(page.locator("#quick-start").getByRole("alert")).toBeVisible();
  await page.evaluate(() =>
    localStorage.setItem("qa-integrity-restored", "yes"),
  );
  await page
    .getByRole("button", { name: "Retry Vanilla generation", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Export personalized Vanilla project" }),
  ).toBeEnabled();
  await expect(page.locator("#quick-start").getByRole("alert")).toHaveCount(0);
});
