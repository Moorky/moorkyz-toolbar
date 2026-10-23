import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const port =
  process.env.MOORKYZ_TOOLBAR_PORTAL_PORT ??
  process.env.PORTAL_TEST_PORT ??
  "4174";
const url = `http://127.0.0.1:${port}`;
const designKey = "moorkyz-toolbar:portal:playground:design:v2";
const autoKey = `${designKey}:autosave`;

async function open(page) {
  await page.goto(`${url}/tools/toolbar/playground`);
  const playground = page.locator("#playground");
  await page
    .locator("#playground-canvas")
    .evaluate((element) =>
      element.scrollIntoView({ block: "start", behavior: "instant" }),
    );
  await expect(playground.getByRole("toolbar")).toBeVisible();
  await expect(
    playground.getByRole("button", { name: "Save locally" }),
  ).toBeEnabled();
  return playground;
}
async function panel(playground, name) {
  const button = playground.getByRole("button", { name, exact: true });
  if ((await button.getAttribute("aria-expanded")) !== "true")
    await button.click();
}
async function app(playground, name) {
  await panel(playground, "Templates");
  await playground
    .getByRole("button", { name: "Application", exact: true })
    .click();
  await playground
    .getByRole("button", { name: new RegExp(`^${name}`) })
    .click();
}

test("all four applications execute real host commands and preserve local state across template changes", async ({
  page,
}) => {
  const external = [];
  page.on("request", (request) => {
    if (!request.url().startsWith(`${url}/`)) external.push(request.url());
  });
  const playground = await open(page);
  await playground
    .getByRole("toolbar")
    .getByRole("button", { name: "New task", exact: true })
    .click();
  await expect(page.getByLabel("New task title")).toBeFocused();
  await page.getByLabel("New task title").fill("Review integration");
  await playground
    .getByRole("button", { name: "Add task", exact: true })
    .click();
  await expect(
    playground.getByRole("checkbox", { name: "Review integration" }),
  ).toBeVisible();
  await app(playground, "Document Editor");
  const toolbar = playground.getByRole("toolbar");
  await expect(
    toolbar.getByRole("button", { name: "Uppercase selection" }),
  ).toBeDisabled();
  const editor = playground.getByLabel("Document content");
  await editor.fill("a useful document");
  await editor.focus();
  await page.keyboard.press("ControlOrMeta+A");
  await toolbar.getByRole("button", { name: "Uppercase selection" }).click();
  await expect(editor).toHaveValue("A USEFUL DOCUMENT");
  await toolbar.getByRole("button", { name: "Count words" }).click();
  await expect(playground.locator(".playground-status")).toContainText(
    "3 words",
  );
  await app(playground, "Analytics Dashboard");
  await expect(
    playground.getByRole("heading", { name: "$6,300" }),
  ).toBeVisible();
  await toolbar.getByRole("button", { name: "Next period" }).click();
  await expect(
    playground.getByRole("heading", { name: "$24,600" }),
  ).toBeVisible();
  await toolbar.getByRole("button", { name: "Filter enterprise" }).click();
  await expect(
    playground.getByRole("heading", { name: "$12,800" }),
  ).toBeVisible();
  await app(playground, "Project Board");
  await toolbar.getByRole("button", { name: "New card", exact: true }).click();
  await expect(playground.getByLabel("New card title")).toBeFocused();
  await playground.getByLabel("New card title").fill("A real board card");
  await playground
    .getByRole("button", { name: "Add card", exact: true })
    .click();
  await expect(
    playground.getByRole("radio", { name: "A real board card" }),
  ).toBeVisible();
  await expect(
    toolbar.getByRole("button", { name: "Advance selected" }),
  ).toBeDisabled();
  await playground
    .getByRole("radio", { name: "Define the experience" })
    .check();
  await toolbar.getByRole("button", { name: "Advance selected" }).click();
  await expect(
    playground
      .getByRole("region", { name: "In progress", exact: true })
      .getByRole("radio", { name: "Define the experience" }),
  ).toBeVisible();
  await app(playground, "Modern Workspace");
  await expect(
    playground.getByRole("checkbox", { name: "Review integration" }),
  ).toBeVisible();
  expect(external).toEqual([]);
});

test("ten structural styles, independent template selection, search and favorites work", async ({
  page,
}) => {
  const playground = await open(page);
  await panel(playground, "Actions");
  await playground
    .locator(".action-editor")
    .first()
    .getByLabel("Accessible name", { exact: true })
    .fill("New task — focus creation");
  await app(playground, "Document Editor");
  await expect(
    playground.getByRole("toolbar").getByRole("button", {
      name: "Add heading — focus creation",
      exact: true,
    }),
  ).toBeVisible();
  await app(playground, "Modern Workspace");
  await expect(
    playground
      .getByRole("toolbar")
      .getByRole("button", { name: "New task — focus creation", exact: true }),
  ).toBeVisible();
  await playground
    .getByRole("button", { name: "Toolbar Style", exact: true })
    .click();
  const styles = [
    "Minimal Floating Pill",
    "Compact Capsule",
    "Rounded Rectangle",
    "Segmented Dock",
    "Full-Width Bottom Dock",
    "Frosted Glass",
    "Outward Trapezoid",
    "Multi-Faceted Dock",
    "Minimal Edge Strip",
    "Angular Floating Toolbar",
  ];
  for (const name of styles) {
    const button = playground.getByRole("button", {
      name: new RegExp(`^${name}`),
    });
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(
      playground.getByRole("toolbar", { name: "Modern Workspace toolbar" }),
    ).toBeVisible();
  }
  await playground
    .getByRole("button", { name: "Favorite Frosted Glass", exact: true })
    .click();
  await playground.getByLabel("Favorites only").check();
  await expect(playground.locator(".template-card")).toHaveCount(1);
  await playground.getByLabel("Favorites only").uncheck();
  await playground.getByLabel("Search templates").fill("trapezoid");
  await expect(playground.locator(".template-card")).toHaveCount(1);
  await playground.getByLabel("Search templates").fill("");
  await app(playground, "Document Editor");
  await panel(playground, "Code & Export");
  const design = JSON.parse(
    await playground.getByLabel("Playground configuration JSON").inputValue(),
  );
  expect(design.style).toBe("angular");
  expect(design.application).toBe("document");
});

test("geometry has bottom-attached zero, bounded edit handles and coherent history", async ({
  page,
}) => {
  const playground = await open(page);
  await panel(playground, "Geometry & Position");
  await playground.getByLabel("Toolbar offsetY", { exact: true }).fill("0");
  const toolbar = playground.getByRole("toolbar");
  await expect
    .poll(() =>
      toolbar
        .locator("..")
        .evaluate((element) => getComputedStyle(element).bottom),
    )
    .toBe("0px");
  await playground.getByLabel("Toolbar radius", { exact: true }).fill("8");
  await expect
    .poll(() =>
      toolbar.evaluate((element) => getComputedStyle(element).borderRadius),
    )
    .toBe("8px");
  await playground.getByLabel("Edit Mode", { exact: true }).check();
  await expect(
    toolbar.getByRole("button", { name: "New task", exact: true }),
  ).toBeDisabled();
  await playground
    .getByRole("button", { name: "Move toolbar", exact: true })
    .focus();
  await page.keyboard.press("ArrowUp");
  await expect(
    playground.getByLabel("Toolbar offsetY", { exact: true }),
  ).toHaveValue("8");
  await playground
    .getByRole("button", { name: "Resize toolbar", exact: true })
    .focus();
  const initialWidth = Math.round((await toolbar.boundingBox()).width);
  await page.keyboard.press("ArrowRight");
  await expect(
    playground.getByLabel("Toolbar width", { exact: true }),
  ).toHaveValue(String(initialWidth + 16));
  await playground.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    playground.getByLabel("Toolbar width", { exact: true }),
  ).toHaveValue("0");
  await playground.getByLabel("Edit Mode", { exact: true }).uncheck();
  await expect(
    toolbar.getByRole("button", { name: "New task", exact: true }),
  ).toBeEnabled();
  const width = playground.getByLabel("Toolbar width", { exact: true });
  await width.fill("");
  await width.pressSequentially("320");
  await expect(width).toHaveValue("320");
  await expect
    .poll(async () => Math.round((await toolbar.boundingBox()).width))
    .toBe(320);
  await playground.getByLabel("Edit Mode", { exact: true }).check();
  const move = playground.getByRole("button", {
    name: "Move toolbar",
    exact: true,
  });
  await move.hover();
  const bounds = await move.boundingBox();
  await page.mouse.down();
  await page.mouse.move(
    bounds.x + bounds.width / 2 + 16,
    bounds.y + bounds.height / 2 - 16,
    { steps: 3 },
  );
  await page.mouse.up();
  await expect(
    playground.getByLabel("Toolbar offsetX", { exact: true }),
  ).toHaveValue("16");
  await expect(
    playground.getByLabel("Toolbar offsetY", { exact: true }),
  ).toHaveValue("24");
  await playground.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    playground.getByLabel("Toolbar offsetX", { exact: true }),
  ).toHaveValue("0");
  await expect(
    playground.getByLabel("Toolbar offsetY", { exact: true }),
  ).toHaveValue("8");
});

test("action operations affect SDK controls, permissions, icons and collapse recovery", async ({
  page,
}) => {
  const playground = await open(page);
  await panel(playground, "Actions");
  await playground.getByLabel("Label for add-task").fill("Capture task");
  const first = playground.locator(".action-editor").first();
  await first
    .getByLabel("Tooltip", { exact: true })
    .fill("Focus task creation");
  await first
    .getByRole("combobox", { name: "Icon", exact: true })
    .selectOption("plus");
  let button = playground
    .getByRole("toolbar")
    .getByRole("button", { name: "Capture task", exact: true });
  await expect(button).toHaveAttribute("title", "Focus task creation");
  await expect(button).toHaveAttribute("data-icon", "+");
  await first.getByRole("button", { name: "Duplicate", exact: true }).click();
  await expect(playground.locator(".action-editor")).toHaveCount(4);
  await first
    .getByRole("button", { name: "Move Capture task later", exact: true })
    .click();
  await expect(
    playground.getByRole("toolbar").locator(".mzk-toolbar__action").first(),
  ).toHaveText("Show / hide completed");
  await playground
    .locator(".action-editor")
    .last()
    .getByRole("button", { name: "Remove", exact: true })
    .click();
  const action = playground.locator(".action-editor").nth(1);
  await action.getByLabel("Enabled", { exact: true }).uncheck();
  await expect(button).toBeDisabled();
  await playground
    .getByRole("button", { name: "Reset sample tasks", exact: true })
    .focus();
  await page.keyboard.press("Tab");
  await expect
    .poll(() =>
      playground
        .getByRole("toolbar")
        .evaluate((element) => element.contains(document.activeElement)),
    )
    .toBe(true);
  await playground
    .getByRole("toolbar")
    .getByRole("button", { name: "Collapse toolbar", exact: true })
    .click();
  await playground
    .getByRole("toolbar")
    .getByRole("button", { name: "Restore toolbar", exact: true })
    .click();
  button = playground
    .getByRole("toolbar")
    .getByRole("button", { name: "Capture task", exact: true });
  await expect(button).toBeDisabled();
  await expect(button).toHaveAttribute("data-icon", "+");
  await action.getByLabel("Enabled", { exact: true }).check();
  await action
    .getByRole("combobox", { name: "Command", exact: true })
    .selectOption("board-archive");
  await expect(button).toBeDisabled();
});

test("manual theme variants synchronize without destroying custom settings or accessibility", async ({
  page,
}) => {
  const playground = await open(page);
  await panel(playground, "Appearance");
  await playground
    .getByLabel("light background color", { exact: true })
    .fill("#f5f0ff");
  await panel(playground, "Actions");
  await playground
    .locator(".action-editor")
    .first()
    .getByLabel("Tooltip", { exact: true })
    .fill("Preserve my color draft");
  await panel(playground, "Appearance");
  await expect(
    playground.getByLabel("light background color", { exact: true }),
  ).toHaveValue("#f5f0ff");
  await playground
    .getByRole("button", { name: "Apply variant colors" })
    .click();
  await page.getByRole("button", { name: "Switch to dark theme" }).focus();
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await page
    .locator("#playground-canvas")
    .evaluate((element) =>
      element.scrollIntoView({ block: "start", behavior: "instant" }),
    );
  await expect(playground.getByRole("toolbar")).toHaveAttribute(
    "data-color-scheme",
    "dark",
  );
  await playground.getByLabel("Edit theme variant").selectOption("dark");
  await playground
    .getByLabel("dark background color", { exact: true })
    .fill("#191124");
  await playground
    .getByRole("button", { name: "Apply variant colors" })
    .click();
  await expect
    .poll(() =>
      playground.getByRole("toolbar").evaluate((element) => {
        const context = document.createElement("canvas").getContext("2d");
        if (!context)
          throw new Error("Canvas color verification is unavailable.");
        context.fillStyle = getComputedStyle(element).backgroundColor;
        context.fillRect(0, 0, 1, 1);
        return Array.from(context.getImageData(0, 0, 1, 1).data);
      }),
    )
    .toEqual([25, 17, 36, 255]);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Switch to light theme" }).focus();
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await playground.getByLabel("Edit theme variant").selectOption("light");
  await expect(
    playground.getByLabel("light background color", { exact: true }),
  ).toHaveValue("#f5f0ff");
});

test("validated JSON preserves the last working design and refuses hostile commands", async ({
  page,
}) => {
  const playground = await open(page);
  await panel(playground, "Code & Export");
  const editor = playground.getByLabel("Playground configuration JSON");
  const design = JSON.parse(await editor.inputValue());
  await editor.fill("{");
  await expect(
    playground.getByRole("button", { name: "Apply Playground JSON" }),
  ).toBeDisabled();
  await panel(playground, "Appearance");
  await expect(
    playground.getByRole("button", { name: "Apply variant colors" }),
  ).toBeDisabled();
  await panel(playground, "Geometry & Position");
  await expect(
    playground.getByLabel("Edit Mode", { exact: true }),
  ).toBeDisabled();
  await playground
    .getByRole("button", { name: "Return to Code & Export" })
    .click();
  await expect(editor).toHaveValue("{");
  await editor.fill(
    JSON.stringify({
      ...design,
      actions: [{ ...design.actions[0], command: "delete-host" }],
    }),
  );
  await expect(playground.locator(".playground-validation")).toContainText(
    "cannot grant host capabilities",
  );
  await expect(
    playground
      .getByRole("toolbar")
      .getByRole("button", { name: "New task", exact: true }),
  ).toBeVisible();
  design.actions[0].label = "<img src=x>";
  design.actions[0].accessibleName = "<img src=x>";
  await editor.fill(JSON.stringify(design));
  await playground
    .getByRole("button", { name: "Apply Playground JSON" })
    .click();
  await expect(
    playground
      .getByRole("toolbar")
      .getByRole("button", { name: "<img src=x>" }),
  ).toBeVisible();
  await expect(playground.locator("img")).toHaveCount(0);
});

test("autosave restores designs, explicit saves confirm replacement and future drafts are preserved", async ({
  page,
}) => {
  let playground = await open(page);
  await panel(playground, "Actions");
  await playground.getByLabel("Label for add-task").fill("Saved task");
  await playground.getByRole("button", { name: "Save locally" }).click();
  await playground.getByLabel("Label for add-task").fill("Autosaved task");
  await expect
    .poll(() =>
      page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)).actions[0].label,
        autoKey,
      ),
    )
    .toBe("Autosaved task");
  await page.reload();
  playground = page.locator("#playground");
  await expect(
    playground
      .getByRole("toolbar")
      .getByRole("button", { name: "Autosaved task" }),
  ).toBeVisible();
  await playground.getByRole("button", { name: "Restore saved" }).click();
  await playground.getByRole("button", { name: "Confirm restore" }).click();
  await expect(
    playground.getByRole("toolbar").getByRole("button", { name: "Saved task" }),
  ).toBeVisible();
  await playground.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    playground
      .getByRole("toolbar")
      .getByRole("button", { name: "Autosaved task" }),
  ).toBeVisible();
  await page.evaluate(
    (key) => localStorage.setItem(key, '{"version":999}'),
    autoKey,
  );
  await page.reload();
  await expect(
    playground.getByRole("group", { name: "Autosave recovery" }),
  ).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), autoKey)).toBe(
    '{"version":999}',
  );
  await playground
    .getByRole("button", { name: "Use current design for autosave" })
    .click();
  await playground.getByRole("button", { name: "Confirm autosave" }).click();
  await expect
    .poll(() =>
      page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)).version,
        autoKey,
      ),
    )
    .toBe(2);
});

test("storage failures are explicit and do not prevent real toolbar actions", async ({
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
  const playground = await open(page);
  await expect(playground.locator(".playground-status")).toContainText(
    "Local storage is unavailable",
  );
  await playground.getByRole("button", { name: "Save locally" }).click();
  await expect(playground.locator(".playground-status")).toContainText(
    "Could not save",
  );
  await page
    .locator("#playground-canvas")
    .evaluate((element) =>
      element.scrollIntoView({ block: "start", behavior: "instant" }),
    );
  await playground
    .getByRole("toolbar")
    .getByRole("button", { name: "New task", exact: true })
    .click();
  await expect(playground.getByLabel("New task title")).toBeFocused();
});

test("design file import is confirmed, undoable and cannot grant another application authority", async ({
  page,
}) => {
  const playground = await open(page);
  await panel(playground, "Code & Export");
  const design = JSON.parse(
    await playground.getByLabel("Playground configuration JSON").inputValue(),
  );
  design.geometry.radius = 12;
  design.actions[0].command = "board-archive";
  await panel(playground, "Advanced Settings");
  await playground.getByLabel("Import Playground design").setInputFiles({
    name: "design.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(design)),
  });
  await expect(playground.locator(".playground-status")).toContainText(
    "Valid import design.json ready",
  );
  await expect(playground.getByRole("toolbar")).toHaveCSS(
    "border-radius",
    "32px",
  );
  await playground
    .getByRole("button", { name: "Confirm design import" })
    .click();
  const toolbar = playground.getByRole("toolbar");
  await expect(toolbar).toHaveCSS("border-radius", "12px");
  const action = toolbar.getByRole("button", { name: "New task", exact: true });
  await expect(action).toBeDisabled();
  await action.evaluate((button) => {
    button.disabled = false;
    button.click();
  });
  await expect(playground.locator(".playground-status")).toContainText(
    "host rejected",
  );
  await expect(playground.locator(".mzk-toolbar__status")).toContainText(
    "Could not complete New task",
  );
  await expect(playground.getByRole("checkbox")).toHaveCount(3);
  await playground.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(toolbar).toHaveCSS("border-radius", "32px");
  await expect(
    toolbar.getByRole("button", { name: "New task", exact: true }),
  ).toBeEnabled();
});

test("mobile preview-first sheet, code view, keyboard resizing and fullscreen preserve state", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const playground = await open(page);
  await expect(
    playground.getByRole("complementary", { name: "Playground settings" }),
  ).not.toBeVisible();
  await playground
    .getByRole("button", { name: "customize", exact: true })
    .click();
  await expect(
    playground.getByRole("complementary", { name: "Playground settings" }),
  ).toBeVisible();
  await playground
    .getByRole("button", { name: "Resize settings sheet" })
    .focus();
  await page.keyboard.press("ArrowUp");
  await playground.getByRole("button", { name: "code", exact: true }).click();
  await expect(
    playground.getByLabel("Playground configuration JSON"),
  ).toBeVisible();
  await playground
    .getByRole("button", { name: "preview", exact: true })
    .click();
  await page
    .locator("#playground-canvas")
    .evaluate((element) =>
      element.scrollIntoView({ block: "start", behavior: "instant" }),
    );
  await playground
    .getByRole("button", { name: "Fullscreen preview", exact: true })
    .click();
  await expect(page.locator("#playground-workspace")).toHaveAttribute(
    "data-focus",
    "true",
  );
  await page
    .locator("#playground-workspace")
    .getByRole("button", { name: "Exit fullscreen", exact: true })
    .click();
  await expect(page.locator("#playground-workspace")).toHaveAttribute(
    "data-focus",
    "false",
  );
  await page
    .locator("#playground-canvas")
    .evaluate((element) =>
      element.scrollIntoView({ block: "start", behavior: "instant" }),
    );
  await expect(playground.locator(".playground-toolbar")).toHaveAttribute(
    "data-visible",
    "true",
  );
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("personalized export executes actual SDK presentation and disposes its resources", async ({
  page,
}) => {
  const playground = await open(page);
  await panel(playground, "Actions");
  await playground.getByLabel("Label for add-task").fill("Exported task");
  await playground
    .locator(".action-editor")
    .first()
    .getByRole("combobox", { name: "Icon", exact: true })
    .selectOption("plus");
  await panel(playground, "Geometry & Position");
  await playground.getByLabel("Toolbar radius", { exact: true }).fill("8");
  await expect(
    page.getByLabel("Personalized Vanilla integration source"),
  ).toContainText("Exported task");
  const ready = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export personalized Vanilla project" })
    .click();
  const downloaded = await ready;
  const exported = JSON.parse(await readFile(await downloaded.path(), "utf8"));
  const files = new Map(
    exported.project.files.map(({ path, content }) => [path, content]),
  );
  expect(JSON.parse(files.get("playground.design.json")).geometry.radius).toBe(
    8,
  );
  const directory = await mkdtemp(
    join(tmpdir(), "moorkyz-playground-consumer-"),
  );
  let worker;
  try {
    for (const [path, content] of files) {
      expect(path).toMatch(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/);
      await writeFile(resolve(directory, path), content, { flag: "wx" });
    }
    worker = new Worker(pathToFileURL(resolve(directory, "server.mjs")), {
      argv: ["--sdk-path", resolve("packages", "toolbar"), "--port", "0"],
      stdout: true,
      stderr: true,
    });
    const consumerURL = await new Promise((resolveReady, reject) => {
      let output = "";
      const timer = setTimeout(
        () =>
          reject(new Error(`Generated server did not become ready: ${output}`)),
        15000,
      );
      worker.stderr.on("data", (chunk) => {
        output += chunk;
      });
      worker.stdout.on("data", (chunk) => {
        output += chunk;
        const match = output.match(/Starter: (http:\/\/127\.0\.0\.1:\d+)/);
        if (match) {
          clearTimeout(timer);
          resolveReady(match[1]);
        }
      });
      worker.on("error", (cause) => {
        clearTimeout(timer);
        reject(cause);
      });
      worker.on("exit", (code) => {
        clearTimeout(timer);
        reject(new Error(`Generated server exited (${code}): ${output}`));
      });
    });
    const failures = [];
    page.on("response", (response) => {
      if (
        response.url().startsWith(`${consumerURL}/`) &&
        response.status() >= 400 &&
        !response.url().endsWith("/favicon.ico")
      )
        failures.push(response.url());
    });
    await page.goto(consumerURL);
    const toolbar = page.getByRole("toolbar", {
      name: "Modern Workspace toolbar",
    });
    const button = toolbar.getByRole("button", {
      name: "Exported task",
      exact: true,
    });
    await button.click();
    await expect(page.locator("#status")).toHaveText("Selected: add-task");
    await expect(button).toHaveAttribute("data-icon", "+");
    await expect
      .poll(() =>
        toolbar.evaluate((element) => getComputedStyle(element).borderRadius),
      )
      .toBe("8px");
    expect(failures).toEqual([]);
    await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
    await expect(toolbar).toHaveCount(0);
  } finally {
    if (worker) await worker.terminate();
    await rm(directory, { recursive: true, force: true });
  }
});
