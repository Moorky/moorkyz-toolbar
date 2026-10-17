import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const port =
  process.env.MOORKYZ_TOOLBAR_PORTAL_PORT ??
  process.env.PORTAL_TEST_PORT ??
  "4174";
const origin = `http://127.0.0.1:${port}`;
const url = `${origin}/studio`;

test("Studio synchronizes flags and JSON, confirms replacements and clears optional UI", async ({
  page,
}) => {
  const external = [];
  page.on("request", (request) => {
    if (!request.url().startsWith(`${origin}/`)) external.push(request.url());
  });
  await page.goto(url);
  const workbench = page.locator(".developer-workbench");
  const preview = workbench.getByRole("toolbar", {
    name: "Development Studio toolbar",
  });
  await expect(preview).toBeVisible();
  await workbench.getByLabel("tasks", { exact: true }).check();
  expect(
    JSON.parse(
      await page.getByLabel("Configuration JSON", { exact: true }).inputValue(),
    ).features.tasks,
  ).toBe(true);
  await expect(preview.getByRole("button", { name: /Tasks/ })).toHaveCount(0);
  await workbench.getByRole("button", { name: "Review configuration" }).click();
  await workbench
    .getByRole("button", { name: "Confirm configuration" })
    .click();
  await preview.getByRole("button", { name: /Tasks/ }).click();
  await expect(workbench.getByText("Synthetic build")).toBeVisible();
  await workbench.getByLabel("tasks", { exact: true }).uncheck();
  await workbench.getByRole("button", { name: "Review configuration" }).click();
  await workbench
    .getByRole("button", { name: "Confirm configuration" })
    .click();
  await expect(workbench.getByText("Synthetic build")).toHaveCount(0);
  await page
    .getByLabel("Configuration JSON", { exact: true })
    .fill('{"features":{"ai":"invalid"}}');
  await expect(
    workbench.getByRole("button", { name: "Review configuration" }),
  ).toBeDisabled();
  await expect(preview).toBeVisible();
  expect(external).toEqual([]);
});

test("versioned configuration import/export validates without executing input", async ({
  page,
}) => {
  await page.goto(url);
  const workbench = page.locator(".developer-workbench");
  await page.getByLabel("Import versioned configuration file").setInputFiles({
    name: "configuration.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        version: 1,
        configuration: {
          label: "Imported toolbar",
          placement: { mode: "container" },
          actions: [{ id: "injected", label: "<img src=x>" }],
          features: { search: false, customize: false },
        },
      }),
    ),
  });
  await workbench
    .getByRole("button", { name: "Confirm configuration" })
    .click();
  const preview = workbench.getByRole("toolbar", { name: "Imported toolbar" });
  await expect(
    preview.getByRole("button", { name: "<img src=x>" }),
  ).toBeVisible();
  await expect(workbench.locator("img")).toHaveCount(0);
  const download = page.waitForEvent("download");
  await workbench
    .getByRole("button", { name: "Download configuration" })
    .click();
  expect((await download).suggestedFilename()).toBe(
    "toolbar.configuration.json",
  );
  await page.getByLabel("Import versioned configuration file").setInputFiles({
    name: "future.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":99,"configuration":{}}'),
  });
  await expect(workbench.locator('p[role="status"]')).toContainText(
    "Unsupported",
  );
  await expect(preview).toBeVisible();
});

test("custom theme authoring applies nonce-scoped styles and preserves previous valid palette", async ({
  page,
}) => {
  const violations = [];
  await page.goto(url);
  await page.evaluate(() =>
    document.addEventListener("securitypolicyviolation", (event) => {
      window.__policyViolations ??= [];
      window.__policyViolations.push(event.violatedDirective);
    }),
  );
  const studio = page.locator(".theme-studio");
  const preview = studio.getByRole("toolbar");
  await studio.getByLabel("background", { exact: true }).fill("#FFF8EC");
  await studio.getByRole("button", { name: "Apply custom theme" }).click();
  await expect(preview).toHaveCSS("background-color", "rgb(255, 248, 236)");
  await studio.getByLabel("foreground", { exact: true }).fill("#FFF8EC");
  await expect(
    studio.getByRole("button", { name: "Apply custom theme" }),
  ).toBeDisabled();
  await expect(preview).toHaveCSS("background-color", "rgb(255, 248, 236)");
  violations.push(
    ...(await page.evaluate(() => window.__policyViolations ?? [])),
  );
  expect(violations).toEqual([]);
});

test("docs and Inspector are local, keyboard-operable and accessible", async ({
  page,
}) => {
  await page.goto(url);
  await expect(page.getByLabel("Documentation version")).toHaveValue("0.1.0");
  await page.getByLabel("Search feature reference").fill("spatial");
  await expect(page.locator(".versioned-docs tbody tr")).toHaveCount(1);
  await expect(page.locator(".versioned-docs tbody")).toContainText("Disabled");
  const workbench = page.locator(".developer-workbench");
  await expect(
    workbench.getByRole("region", { name: "Local Dock Inspector" }),
  ).toHaveCount(0);
  await workbench
    .getByText("Optional local Dock Inspector", { exact: true })
    .click();
  const checkbox = workbench.getByLabel(
    "Enable redacted synthetic diagnostics",
  );
  await checkbox.focus();
  await page.keyboard.press("Space");
  await expect(
    workbench.getByRole("region", { name: "Local Dock Inspector" }),
  ).toContainText("STUDIO_PREVIEW");
  await checkbox.uncheck();
  await expect(
    workbench.getByRole("region", { name: "Local Dock Inspector" }),
  ).toHaveCount(0);
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations).toEqual([]);
});

test("Scenario Lab rejects unknown snapshots and imports deterministic replay data", async ({
  page,
}) => {
  await page.goto(url);
  await page
    .getByLabel("Import scenario data")
    .fill('{"version":9,"scenario":{}}');
  await page
    .getByRole("button", { name: "Import snapshot", exact: true })
    .click();
  await expect(page.locator(".scenario-lab-status")).toContainText(
    "Unsupported",
  );
  await page.getByLabel("Import scenario data").fill(
    JSON.stringify({
      version: 1,
      scenario: {
        context: "editor",
        viewport: "compact",
        simulatedMinute: 30,
        allowActions: false,
        failOnAction: false,
      },
    }),
  );
  await page
    .getByRole("button", { name: "Import snapshot", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Replay snapshot", exact: true })
    .click();
  await expect(page.getByLabel("Simulated context")).toHaveValue("editor");
  await expect(page.getByLabel("Simulated viewport")).toHaveValue("compact");
  await expect(page.getByLabel("Host allows navigation")).not.toBeChecked();
});

test("Extension Studio routes fixed trusted recipes through host authorization and revocation", async ({
  page,
}) => {
  await page.goto(url);
  const studio = page.locator(".extension-studio");
  const preview = studio.getByRole("toolbar", {
    name: "Trusted extension preview",
  });
  await expect(
    preview.getByRole("button", { name: "Open preview panel" }),
  ).toHaveCount(0);
  await studio.getByRole("button", { name: "Register trusted recipe" }).click();
  const action = preview.getByRole("button", { name: "Open preview panel" });
  await action.click();
  await expect(studio.getByRole("status")).toContainText(
    "No application command or network ran",
  );
  await studio.getByLabel("Host authorizes this recipe").uncheck();
  await action.click();
  await expect(studio.getByRole("status")).toContainText(/denied|authoriz/i);
  await studio.getByLabel("Host authorizes this recipe").check();
  await studio.getByRole("button", { name: "Register trusted recipe" }).click();
  await studio.getByLabel("Simulate extension host fault").check();
  await action.click();
  await expect(studio.getByRole("status")).toContainText(/failed|fault/i);
  await studio.getByRole("button", { name: "Revoke trusted recipe" }).click();
  await expect(action).toHaveCount(0);
  await studio
    .getByLabel("Trusted extension manifest JSON")
    .fill(
      '{"schemaVersion":"1.0","id":"other","trust":"trusted","actions":[]}',
    );
  await studio.getByRole("button", { name: "Register trusted recipe" }).click();
  await expect(studio.getByRole("status")).toContainText(
    "Only the version 1.0 trusted studio recipe",
  );
});

test("Starter Studio uses the shared generator and exports local reviewable source data", async ({
  page,
}) => {
  await page.goto(url);
  const studio = page.locator(".starter-studio");
  await studio.getByLabel("Starter project name").fill("fixture-project");
  await studio.getByLabel("Starter preset").selectOption("editor");
  await studio
    .getByRole("button", { name: "Generate starter", exact: true })
    .click();
  await expect(studio.locator('p[role="status"]')).toContainText(
    "Versioned starter generated",
  );
  await studio.getByLabel("Generated source file").selectOption("package.json");
  await expect(
    studio.locator('pre[aria-label="Generated starter source"]'),
  ).toContainText("@moorkyz/toolbar");
  const download = page.waitForEvent("download");
  await studio.getByRole("button", { name: "Download starter data" }).click();
  expect((await download).suggestedFilename()).toBe("toolbar.starter.json");
  await studio.getByLabel("Starter project name").fill("../unsafe");
  await studio
    .getByRole("button", { name: "Generate starter", exact: true })
    .click();
  await expect(studio.locator('p[role="status"]')).toContainText(
    /name|invalid/i,
  );
});
