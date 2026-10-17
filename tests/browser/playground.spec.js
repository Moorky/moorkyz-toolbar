import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const port =
  process.env.MOORKYZ_TOOLBAR_PORTAL_PORT ??
  process.env.PORTAL_TEST_PORT ??
  "4174";
const url = `http://127.0.0.1:${port}`;
const storageKey = "moorkyz-toolbar:portal:playground:v1";

async function openPlayground(page) {
  await page.goto(url);
  const playground = page.locator("#playground");
  const toolbar = playground.getByRole("toolbar", {
    name: "Modern Workspace toolbar",
  });
  await expect(toolbar).toBeVisible();
  await expect(
    playground.getByRole("button", { name: "Save locally" }),
  ).toBeEnabled();
  return { playground, toolbar };
}

test("real SDK commands control the local application and configuration history is separate", async ({
  page,
}) => {
  const external = [];
  page.on("request", (request) => {
    if (!request.url().startsWith(`${url}/`)) external.push(request.url());
  });
  const { playground, toolbar } = await openPlayground(page);
  await toolbar.getByRole("button", { name: "New task", exact: true }).click();
  await expect(page.getByLabel("New task title")).toBeFocused();
  await page.getByLabel("New task title").fill("Review integration");
  await playground
    .getByRole("button", { name: "Add task", exact: true })
    .click();
  await expect(
    playground.getByRole("checkbox", { name: "Review integration" }),
  ).toBeVisible();
  await toolbar.getByRole("button", { name: "Show / hide completed" }).click();
  await expect(
    playground.getByRole("checkbox", { name: "Explore your new workspace" }),
  ).toHaveCount(0);
  await toolbar.getByRole("button", { name: "Clear completed" }).click();

  await playground
    .getByRole("button", { name: "Actions", exact: true })
    .click();
  await playground.getByLabel("Label for add-task").fill("Capture task");
  await expect(
    toolbar.getByRole("button", { name: "Capture task" }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Personalized Vanilla integration source"),
  ).toContainText("Capture task");
  await playground.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    toolbar.getByRole("button", { name: "New task", exact: true }),
  ).toBeVisible();
  await expect(
    playground.getByRole("checkbox", { name: "Review integration" }),
  ).toBeVisible();
  await expect(
    playground.getByRole("checkbox", { name: "Explore your new workspace" }),
  ).toHaveCount(0);
  await playground.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(
    toolbar.getByRole("button", { name: "Capture task" }),
  ).toBeVisible();
  await playground.getByRole("button", { name: "Reset configuration" }).click();
  await playground.getByRole("button", { name: "Confirm reset" }).click();
  await expect(
    toolbar.getByRole("button", { name: "New task", exact: true }),
  ).toBeVisible();
  await playground.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    toolbar.getByRole("button", { name: "Capture task" }),
  ).toBeVisible();
  expect(external).toEqual([]);
});

test("JSON rejects invalid or unauthorized config, retaining preview and personalized output", async ({
  page,
}) => {
  const { playground, toolbar } = await openPlayground(page);
  await playground
    .getByRole("button", { name: "Code & Export", exact: true })
    .click();
  const editor = playground.getByLabel("Playground configuration JSON");
  const initial = JSON.parse(await editor.inputValue());
  await editor.fill("{");
  await expect(
    playground.getByRole("button", { name: "Apply Playground JSON" }),
  ).toBeDisabled();
  await expect(playground.locator(".playground-validation")).toContainText(
    "not valid JSON",
  );
  await expect(
    toolbar.getByRole("button", { name: "New task", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Personalized Vanilla integration source"),
  ).toContainText("New task");
  await playground
    .getByRole("button", { name: "Appearance", exact: true })
    .click();
  await expect(playground.getByLabel("Toolbar token family")).toBeDisabled();
  await playground
    .getByRole("button", { name: "Return to Code & Export" })
    .click();
  await expect(editor).toHaveValue("{");
  await editor.fill(JSON.stringify({ ...initial, features: { ai: true } }));
  await expect(playground.locator(".playground-validation")).toContainText(
    "cannot grant host capabilities",
  );
  await expect(
    playground.getByRole("button", { name: "Save locally" }),
  ).toBeDisabled();
  await expect(
    playground.getByRole("button", { name: "Apply Playground JSON" }),
  ).toBeDisabled();

  initial.actions[0].label = "<img src=x>";
  await editor.fill(JSON.stringify(initial));
  await playground
    .getByRole("button", { name: "Apply Playground JSON" })
    .click();
  await expect(
    toolbar.getByRole("button", { name: "<img src=x>" }),
  ).toBeVisible();
  await expect(playground.locator("img")).toHaveCount(0);
  await expect(
    page.getByLabel("Personalized Vanilla integration source"),
  ).toContainText("<img src=x>");
});

test("configuration storage is explicit, confirmed, versioned and recoverable", async ({
  page,
}) => {
  const { playground, toolbar } = await openPlayground(page);
  await playground
    .getByRole("button", { name: "Actions", exact: true })
    .click();
  await playground.getByLabel("Label for add-task").fill("Saved task");
  expect(
    await page.evaluate((key) => localStorage.getItem(key), storageKey),
  ).toBeNull();
  await playground.getByRole("button", { name: "Save locally" }).click();
  await playground.getByLabel("Label for add-task").fill("Unsaved task");
  await playground.getByRole("button", { name: "Save locally" }).click();
  await expect(
    playground.getByRole("group", { name: "Confirm configuration change" }),
  ).toBeVisible();
  await playground.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(
    await page.evaluate(
      (key) =>
        JSON.parse(localStorage.getItem(key)).configuration.actions[0].label,
      storageKey,
    ),
  ).toBe("Saved task");
  await page.reload();
  await expect(playground.locator(".playground-status")).toContainText(
    "saved configuration is available",
  );
  await expect(
    toolbar.getByRole("button", { name: "New task", exact: true }),
  ).toBeVisible();
  await playground.getByRole("button", { name: "Restore saved" }).click();
  await playground.getByRole("button", { name: "Confirm restore" }).click();
  await expect(
    toolbar.getByRole("button", { name: "Saved task" }),
  ).toBeVisible();
  await playground.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    toolbar.getByRole("button", { name: "New task", exact: true }),
  ).toBeVisible();
  await page.evaluate(
    (key) => localStorage.setItem(key, '{"version":99,"configuration":{}}'),
    storageKey,
  );
  await playground.getByRole("button", { name: "Restore saved" }).click();
  await playground.getByRole("button", { name: "Confirm restore" }).click();
  await expect(playground.locator(".playground-status")).toContainText(
    "Unsupported saved draft",
  );
  await expect(
    toolbar.getByRole("button", { name: "New task", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), storageKey),
  ).toContain('"version":99');
});

test("unavailable local storage reports failures without breaking the application", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new DOMException("Blocked", "SecurityError");
    };
    Storage.prototype.setItem = () => {
      throw new DOMException("Blocked", "SecurityError");
    };
  });
  const { playground, toolbar } = await openPlayground(page);
  await expect(playground.locator(".playground-status")).toContainText(
    "Local storage is unavailable",
  );
  await playground.getByRole("button", { name: "Save locally" }).click();
  await expect(playground.locator(".playground-status")).toContainText(
    "Could not save",
  );
  await toolbar.getByRole("button", { name: "New task", exact: true }).click();
  await expect(page.getByLabel("New task title")).toBeFocused();
});

test("global theme synchronizes Workspace, SDK and generation while preserving the token family", async ({
  page,
}) => {
  const { playground, toolbar } = await openPlayground(page);
  await playground
    .getByRole("button", { name: "Appearance", exact: true })
    .click();
  await playground
    .getByLabel("Toolbar token family")
    .selectOption("warm-minimal");
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(playground.locator(".playground-application")).toHaveAttribute(
    "data-theme",
    "dark",
  );
  await expect(toolbar).toHaveAttribute("data-color-scheme", "dark");
  await expect(toolbar).toHaveAttribute("data-theme", "warm-minimal");
  await expect(
    page.getByLabel("Personalized Vanilla integration source"),
  ).toContainText('"colorScheme": "dark"');
  await expect(
    page.getByLabel("Personalized Vanilla integration source"),
  ).toContainText('"theme": "warm-minimal"');
  const scan = await new AxeBuilder({ page }).analyze();
  expect(scan.violations).toEqual([]);
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await expect(toolbar).toHaveAttribute("data-color-scheme", "light");
  await expect(toolbar).toHaveAttribute("data-theme", "warm-minimal");
});

test("responsive workspace is bounded, has no mobile overflow and supports keyboard and reduced motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const { playground, toolbar } = await openPlayground(page);
  const workspaceBounds = await playground
    .locator(".playground-workspace")
    .boundingBox();
  expect(workspaceBounds.height).toBeLessThanOrEqual(610);
  await page.setViewportSize({ width: 360, height: 780 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  const appearance = playground.getByRole("button", {
    name: "Appearance",
    exact: true,
  });
  await appearance.focus();
  await page.keyboard.press("Enter");
  await expect(appearance).toHaveAttribute("aria-expanded", "true");
  await expect(
    playground.getByRole("button", { name: "Templates", exact: true }),
  ).toHaveAttribute("aria-expanded", "false");
  await toolbar.getByRole("button", { name: "New task", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    toolbar.getByRole("button", { name: "Show / hide completed" }),
  ).toBeFocused();
  const scan = await new AxeBuilder({ page }).analyze();
  expect(scan.violations).toEqual([]);
});

test("exported personalized Vanilla source mounts the real SDK and disposes on pagehide", async ({
  page,
  baseURL,
}) => {
  const { playground } = await openPlayground(page);
  await playground
    .getByRole("button", { name: "Actions", exact: true })
    .click();
  await playground.getByLabel("Label for add-task").fill("Exported task");
  await expect(
    page.getByLabel("Personalized Vanilla integration source"),
  ).toContainText("Exported task");
  const downloadReady = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export personalized Vanilla project" })
    .click();
  const download = await downloadReady;
  expect(download.suggestedFilename()).toBe("toolbar.playground.vanilla.json");
  const exported = JSON.parse(await readFile(await download.path(), "utf8"));
  expect(exported.version).toBe(1);
  expect(exported.project.manifest.configuration.actions[0].label).toBe(
    "Exported task",
  );
  const files = new Map(
    exported.project.files.map(({ path, content }) => [path, content]),
  );
  await page.route(`${baseURL}/personalized/**`, (route) => {
    const name = new URL(route.request().url()).pathname.split("/").at(-1);
    const body = files.get(name || "index.html");
    if (body === undefined) return route.fulfill({ status: 404 });
    return route.fulfill({
      contentType: name?.endsWith(".js")
        ? "text/javascript"
        : name?.endsWith(".css")
          ? "text/css"
          : "text/html",
      body,
    });
  });
  await page.route(`${baseURL}/vendor/**`, (route) => {
    const path = new URL(route.request().url()).pathname.replace(
      "/vendor/",
      "/toolbar/",
    );
    return route.continue({ url: `${baseURL}${path}` });
  });
  await page.goto(`${baseURL}/personalized/index.html`);
  const starter = page.getByRole("toolbar", {
    name: "Modern Workspace toolbar",
  });
  await starter.getByRole("button", { name: "Exported task" }).click();
  await expect(page.locator("#status")).toHaveText("Selected: add-task");
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await expect(starter).toHaveCount(0);
});

test("adaptive header hides down, reveals up and remains reachable by keyboard", async ({
  page,
}) => {
  await openPlayground(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const header = page.locator(".adaptive-header");
  await page.evaluate(() => window.scrollTo({ top: 900, behavior: "instant" }));
  await expect(header).toHaveAttribute("data-hidden", "true");
  await page.evaluate(() => window.scrollTo({ top: 600, behavior: "instant" }));
  await expect(header).toHaveAttribute("data-hidden", "false");
  await page.evaluate(() =>
    window.scrollTo({ top: 1000, behavior: "instant" }),
  );
  await expect(header).toHaveAttribute("data-hidden", "true");
  await header.getByRole("link", { name: "Playground", exact: true }).focus();
  await expect(header).toHaveAttribute("data-hidden", "false");
});
