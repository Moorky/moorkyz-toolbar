import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const portalPort =
  process.env.MOORKYZ_TOOLBAR_PORTAL_PORT ??
  process.env.PORTAL_TEST_PORT ??
  "4174";
const portalUrl = `http://127.0.0.1:${portalPort}`;

test("portal mounts the actual library and updates its actions by context", async ({
  page,
}) => {
  const externalRequests = [];
  page.on("request", (request) => {
    if (!request.url().startsWith(`${portalUrl}/`)) {
      externalRequests.push(request.url());
    }
  });
  const response = await page.goto(portalUrl);
  const policy = response.headers()["content-security-policy"];
  expect(policy).toContain("script-src 'self' 'nonce-");
  expect(policy).toContain("style-src 'self' 'nonce-");
  expect(policy).toContain("frame-ancestors 'none'");
  expect(policy).not.toContain("unsafe-inline");
  const socialCard = await page.request.get(
    `${portalUrl}/moorkyz-toolbar-github.png`,
  );
  expect(socialCard.ok()).toBe(true);
  expect(socialCard.headers()["content-type"]).toContain("image/png");

  const toolbar = page.getByRole("toolbar", {
    name: "Moorkyz Toolbar website navigation",
  });
  await expect(toolbar).toBeVisible();
  await expect(toolbar.getByRole("button", { name: "Explore" })).toBeVisible();

  await page
    .locator(".environment-demo")
    .getByRole("button", { name: "Dashboard" })
    .click();
  await expect(
    page.getByRole("button", { name: "Built for control" }),
  ).toBeVisible();
  expect(externalRequests).toEqual([]);
});

test("portal theme persists locally and updates the mounted dock tokens", async ({
  page,
}) => {
  await page.goto(portalUrl);
  const toolbar = page.getByRole("toolbar", {
    name: "Moorkyz Toolbar website navigation",
  });
  await expect(toolbar).toBeVisible();
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  const dockBackground = await toolbar.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );
  expect(dockBackground).toBe("rgba(20, 16, 29, 0.96)");
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations).toEqual([]);

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(
    page.getByRole("button", { name: "Switch to light theme" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("visual configurator validates drafts before applying a real preview", async ({
  page,
}) => {
  await page.goto(`${portalUrl}/studio`);
  expect(
    await page.evaluate(() =>
      localStorage.getItem("moorkyz-toolbar:portal:visual-configurator:v1"),
    ),
  ).toBeNull();
  const actionLabel = page.getByRole("textbox", { name: "Action label" });
  const apply = page.getByRole("button", { name: "Apply to live preview" });
  const preview = page.getByRole("toolbar", { name: "Preview toolbar" });
  await expect(
    preview.getByRole("button", { name: "Documentation" }),
  ).toBeVisible();

  await actionLabel.fill("Run task");
  await page.getByLabel("Theme", { exact: true }).selectOption("midnight");
  await apply.click();
  await expect(preview).toHaveAttribute("data-theme", "midnight");
  await expect(preview.getByRole("button", { name: "Run task" })).toBeVisible();
  await expect(page.locator(".configurator-code")).toContainText(
    '"label": "Run task"',
  );
  await preview.getByRole("button", { name: "Run task" }).click();
  await expect(page.locator(".configurator-status")).toHaveText(
    'The host received action "docs".',
  );

  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations).toEqual([]);

  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await actionLabel.fill("");
  await expect(page.locator(".configurator-validation")).toContainText(
    "actions.0.label: Action labels must be non-empty strings.",
  );
  await expect(apply).toBeDisabled();
  await expect(preview.getByRole("button", { name: "Run task" })).toBeVisible();
  const invalidDraftScan = await new AxeBuilder({ page }).analyze();
  expect(invalidDraftScan.violations).toEqual([]);

  await page.reload();
  await expect(page.getByLabel("Action label")).toHaveValue("Documentation");
  await expect(
    page.getByRole("toolbar", { name: "Preview toolbar" }),
  ).toHaveAttribute("data-theme", "signature");
});

test("visual configurator saves only explicit versioned local drafts", async ({
  page,
}) => {
  const storageKey = "moorkyz-toolbar:portal:visual-configurator:v1";
  await page.goto(`${portalUrl}/studio`);
  await page.getByLabel("Action label").fill("Saved docs");
  await page.getByLabel("Theme", { exact: true }).selectOption("warm-minimal");
  expect(
    await page.evaluate((key) => localStorage.getItem(key), storageKey),
  ).toBeNull();
  await page.getByRole("button", { name: "Save draft locally" }).click();

  const savedDraft = await page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  }, storageKey);
  expect(savedDraft).not.toBeNull();
  expect(savedDraft.version).toBe(1);
  expect(savedDraft.draft.actionLabel).toBe("Saved docs");

  await page.getByLabel("Action label").fill("Replacement docs");
  await page.getByRole("button", { name: "Save draft locally" }).click();
  await expect(
    page.getByText("A local draft already exists. Replace it?"),
  ).toBeVisible();
  const originalSavedLabel = await page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw).draft.actionLabel;
  }, storageKey);
  expect(originalSavedLabel).toBe("Saved docs");
  await page.getByRole("button", { name: "Confirm replace" }).click();

  await page.reload();
  await expect(page.getByLabel("Action label")).toHaveValue("Documentation");
  await page.getByRole("button", { name: "Restore local draft" }).click();
  await expect(page.getByLabel("Action label")).toHaveValue("Replacement docs");
  await expect(
    page.getByRole("toolbar", { name: "Preview toolbar" }),
  ).toHaveAttribute("data-theme", "warm-minimal");

  await page.getByRole("button", { name: "Delete saved draft" }).click();
  await expect(
    page.getByText("Delete the saved draft from this browser?"),
  ).toBeVisible();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), storageKey),
  ).not.toBeNull();
  await page.getByRole("button", { name: "Confirm delete" }).click();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), storageKey),
  ).toBeNull();
});

test("visual configurator rejects invalid local drafts without replacing current state", async ({
  page,
}) => {
  const storageKey = "moorkyz-toolbar:portal:visual-configurator:v1";
  await page.addInitScript((key) => {
    localStorage.setItem(
      key,
      JSON.stringify({
        version: 1,
        draft: {
          label: "",
          actionLabel: "Injected",
          theme: "signature",
          colorScheme: "system",
          placement: "container",
          search: true,
        },
      }),
    );
  }, storageKey);
  await page.goto(`${portalUrl}/studio`);

  await page.getByRole("button", { name: "Restore local draft" }).click();
  await expect(page.locator(".configurator-storage-status")).toContainText(
    "Saved draft failed schema validation",
  );
  await expect(page.getByLabel("Toolbar label")).toHaveValue("Preview toolbar");
  await expect(page.getByLabel("Action label")).toHaveValue("Documentation");
  await expect(
    page.getByRole("toolbar", { name: "Preview toolbar" }),
  ).toHaveAttribute("data-theme", "signature");

  await page.evaluate((key) => {
    localStorage.setItem(key, JSON.stringify({ version: 2, draft: {} }));
  }, storageKey);
  await page.getByRole("button", { name: "Restore local draft" }).click();
  await expect(page.locator(".configurator-storage-status")).toContainText(
    "unsupported format or version",
  );
  await expect(page.getByLabel("Action label")).toHaveValue("Documentation");
});

test("component lab runs real overflow, search, and collapse states", async ({
  page,
}) => {
  await page.goto(`${portalUrl}/studio`);
  const lab = page.locator("#component-lab");
  const preview = lab.getByRole("toolbar", { name: "Component lab toolbar" });

  await lab.getByRole("button", { name: "Narrow action row" }).click();
  await expect(
    preview.getByRole("button", {
      name: "Scroll toolbar actions toward end",
    }),
  ).toBeVisible();
  await lab.getByRole("button", { name: "Search enabled" }).click();
  await expect(preview.getByRole("button", { name: "Search" })).toBeVisible();
  await preview.getByRole("button", { name: "Search" }).click();
  await expect(
    lab.getByRole("searchbox", {
      name: "Search toolbar actions and content",
    }),
  ).toBeVisible();
  const searchOpenScan = await new AxeBuilder({ page }).analyze();
  expect(searchOpenScan.violations).toEqual([]);

  const collapse = lab.getByRole("button", {
    name: "Collapse preview toolbar",
  });
  await collapse.click();
  await expect(
    preview.getByRole("button", { name: "Restore toolbar" }),
  ).toBeVisible();
  await lab.getByRole("button", { name: "Expand preview toolbar" }).click();
  await expect(preview.getByRole("button", { name: "Home" })).toBeVisible();

  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations).toEqual([]);
});

test("Scenario Lab replays deterministic permission, fault, time, and viewport snapshots", async ({
  page,
}) => {
  await page.goto(`${portalUrl}/studio`);
  const lab = page.locator("#scenario-lab");
  const toolbar = lab.getByRole("toolbar", { name: "Scenario Lab toolbar" });
  const permission = lab.getByLabel("Host allows navigation");
  const simulatedTime = lab.getByLabel(/Simulated time/);

  await lab.getByLabel("Simulated context").selectOption("dashboard");
  await expect(
    toolbar.getByRole("button", { name: "Built for control" }),
  ).toBeVisible();
  await permission.uncheck();
  await toolbar.getByRole("button", { name: "Built for control" }).click();
  await expect(lab.locator(".scenario-lab-status")).toContainText(
    'Simulated host denied "engineering"',
  );

  await simulatedTime.focus();
  await page.keyboard.press("ArrowRight");
  await expect(lab.locator('label[for="scenario-time"]')).toContainText(
    "00:05",
  );
  await permission.check();
  await lab.getByLabel("Simulate host action failure").check();
  await toolbar.getByRole("button", { name: "Built for control" }).click();
  await expect(lab.locator(".scenario-lab-status")).toContainText(
    'Simulated host failure for "engineering" was reported.',
  );

  await lab.getByRole("button", { name: "Capture snapshot" }).click();
  await expect(
    lab.getByRole("region", { name: "Scenario Lab preview" }),
  ).toBeVisible();
  await expect(lab.getByLabel("Scenario snapshot JSON")).toContainText(
    '"simulatedMinute": 5',
  );

  await lab.getByLabel("Simulated context").selectOption("editor");
  await lab.getByLabel("Simulated viewport").selectOption("compact");
  await permission.uncheck();
  await lab.getByLabel("Simulate host action failure").uncheck();
  await lab.getByRole("button", { name: "Replay snapshot" }).click();
  await expect(lab.getByLabel("Simulated context")).toHaveValue("dashboard");
  await expect(lab.getByLabel("Simulated viewport")).toHaveValue("wide");
  await expect(permission).toBeChecked();
  await expect(lab.getByLabel("Simulate host action failure")).toBeChecked();
  await expect(lab.locator('label[for="scenario-time"]')).toContainText(
    "00:05",
  );

  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations).toEqual([]);
});

test("Theme Studio inspects built-in tokens and exports versioned validated data", async ({
  page,
}) => {
  await page.goto(`${portalUrl}/studio`);
  const studio = page.locator("#theme-studio");
  const selection = studio.getByLabel("Built-in theme");

  for (const theme of [
    "signature",
    "frosted-glass",
    "midnight",
    "warm-minimal",
    "high-contrast",
    "project-adaptive",
  ]) {
    await selection.selectOption(theme);
    await expect(
      studio.getByRole("toolbar", { name: `${theme} theme preview` }),
    ).toHaveAttribute("data-theme", theme);
    await expect(studio).toContainText("Token validation passed.");
    const exportedTheme = await studio
      .locator(".theme-studio-export pre")
      .textContent();
    expect(JSON.parse(exportedTheme).version).toBe(1);
    expect(JSON.parse(exportedTheme).theme).toBe(theme);
  }

  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations).toEqual([]);
});

test("toolbar preferences persist in the portal's explicit local namespace", async ({
  page,
}) => {
  await page.goto(portalUrl);
  const toolbar = page.getByRole("toolbar", {
    name: "Moorkyz Toolbar website navigation",
  });
  await page.getByRole("button", { name: "Customize toolbar" }).click();
  await page.getByRole("button", { name: /Theme: Signature/ }).click();
  await expect(toolbar).toHaveAttribute("data-theme", "frosted-glass");
  await page
    .getByRole("button", { name: /finish customizing toolbar/i })
    .click();

  await page.reload();
  await expect(
    page.getByRole("toolbar", {
      name: "Moorkyz Toolbar website navigation",
    }),
  ).toHaveAttribute("data-theme", "frosted-glass");
});

test("portal landing page has no automated axe violations", async ({
  page,
}) => {
  await page.goto(portalUrl);
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations).toEqual([]);
});
